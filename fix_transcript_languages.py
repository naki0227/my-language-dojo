import os
import re
import time
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

# --- Configuration ---
env_path = Path('.') / '.env.local'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing env vars")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
ytt_api = YouTubeTranscriptApi()

# Map Subject (DB) to Language Code (YouTube)
SUBJECT_TO_LANG_CODES = {
    'English': ['en', 'en-US', 'en-GB'],
    'French': ['fr', 'fr-FR', 'fr-CA'],
    'Spanish': ['es', 'es-ES', 'es-MX', 'es-419'],
    'German': ['de', 'de-DE'],
    'Italian': ['it', 'it-IT'],
    'Japanese': ['ja'],
    'Korean': ['ko'],
    'Chinese': ['zh', 'zh-Hans', 'zh-Hant', 'zh-CN', 'zh-TW'],
}

def get_expected_languages():
    """
    Fetch all videos from roadmap_items and library_videos to determine their expected subject.
    Returns a dict: { video_id: subject }
    """
    video_subjects = {}

    # 1. Roadmap Items
    print("Fetching roadmap items...")
    res = supabase.table("roadmap_items").select("video_id, subject").execute()
    for item in res.data:
        if item['video_id'] and item['subject']:
            video_subjects[item['video_id']] = item['subject']

    # 2. Library Videos
    print("Fetching library videos...")
    res = supabase.table("library_videos").select("video_id, subject").execute()
    for item in res.data:
        if item['video_id'] and item['subject']:
            # Roadmap takes precedence if conflict (arbitrary choice, but roadmap is usually more curated)
            if item['video_id'] not in video_subjects:
                video_subjects[item['video_id']] = item['subject']
    
    return video_subjects

def get_current_transcripts():
    """
    Fetch all optimized transcripts with their language.
    Returns a list of dicts: [{ video_id, language, content }]
    """
    print("Fetching current transcripts...")
    # Fetching all might be heavy, but let's try. If too large, we'd need pagination.
    # For now assuming < 1000 items or reasonable size.
    res = supabase.table("optimized_transcripts").select("video_id, language").execute()
    return res.data

def fetch_youtube_transcript(video_id, lang_codes):
    """
    Fetch transcript from YouTube in the specified language.
    """
    try:
        # Use fetch directly. It prefers manually created transcripts.
        # It will raise an exception if no transcript matches the language.
        data = ytt_api.fetch(video_id, languages=lang_codes)
        
        # Clean text
        text_segments = [line['text'] for line in data]
        full_text = " ".join(text_segments)
        full_text = full_text.replace("\n", " ")
        full_text = re.sub(r'\s+', ' ', full_text).strip()
        return full_text, "Success"
            
    except NoTranscriptFound:
        return None, "Not Found"
    except Exception as e:
        return None, str(e)

def main():
    print("--- Starting Transcript Language Fix ---")
    
    expected_map = get_expected_languages()
    current_transcripts = get_current_transcripts()
    
    print(f"Found {len(expected_map)} videos with expected subjects.")
    print(f"Found {len(current_transcripts)} existing transcripts.")

    mismatch_count = 0
    fixed_count = 0
    
    for t in current_transcripts:
        vid = t['video_id']
        current_lang = t.get('language')
        
        if vid not in expected_map:
            continue
            
        expected_subject = expected_map[vid]
        expected_codes = SUBJECT_TO_LANG_CODES.get(expected_subject)
        
        if not expected_codes:
            print(f"Skipping {vid}: Unknown subject '{expected_subject}'")
            continue

        # Check for mismatch
        is_mismatch = False
        if current_lang not in expected_codes:
            is_mismatch = True
            
        if is_mismatch:
            print(f"Mismatch found for {vid}: Current='{current_lang}', Expected='{expected_subject}' ({expected_codes})")
            mismatch_count += 1
            
            # Fetch new transcript
            print(f"  -> Fetching new transcript in {expected_codes}...")
            new_text, status = fetch_youtube_transcript(vid, expected_codes)
            
            if new_text:
                print(f"  -> Success! Updating database...")
                try:
                    # We don't know exactly which code matched, but we can assume the first one or just save the subject?
                    # Ideally we should save the actual code, but fetch() doesn't return it easily in this structure.
                    # Wait, fetch() returns FetchedTranscript?
                    # If it returns a list of dicts, we don't know the code.
                    # But we can just save the PRIMARY code (e.g. 'en') or the Subject name?
                    # The DB has 'language' column.
                    # Let's save the first code in the list as a canonical code, OR keep it simple.
                    # Actually, if we successfully fetched, it means one of them matched.
                    # Let's save the first code for now, or 'en' for English.
                    canonical_lang = expected_codes[0]
                    
                    supabase.table("optimized_transcripts").update({
                        "content": new_text,
                        "language": canonical_lang
                    }).eq("video_id", vid).execute()
                    fixed_count += 1
                    print(f"  -> Saved as '{canonical_lang}'.")
                except Exception as e:
                    print(f"  -> DB Error: {e}")
            else:
                print(f"  -> Failed to fetch transcript: {status}")
            
            # Sleep to avoid rate limits
            time.sleep(1)

    print("------------------------------------------------")
    print(f"Process Complete.")
    print(f"Total Mismatches Found: {mismatch_count}")
    print(f"Total Fixed: {fixed_count}")

if __name__ == "__main__":
    main()
