import sys
import json
import re
import time
import random
import os
import glob
import yt_dlp
import psycopg2
from psycopg2.extras import Json

# ==========================================
# 設定エリア
# ==========================================

# ★パスワード入りの接続文字列に書き換えてください★
DB_CONNECTION_STRING = "postgresql://postgres.ushnduxczcavsicwizde:Carp3351nagase@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

ID_LIST_FILE = "video_ids.txt"

TARGET_LANGS = [
    'ja', 'en.*', 'es.*', 'fr.*', 'zh.*', 
    'ko.*', 'pt.*', 'ar.*', 'ru.*', 'de.*', 'it.*'
]

# ==========================================

def get_db_connection():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        return conn
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        sys.exit(1)

def time_to_ms(t_str):
    try:
        if '.' in t_str:
            hms, ms = t_str.split('.')
        else:
            hms, ms = t_str, 0
        parts = hms.split(':')
        h, m, s = 0, 0, 0
        if len(parts) == 3:
            h, m, s = map(int, parts)
        elif len(parts) == 2:
            m, s = map(int, parts)
        return (h * 3600 + m * 60 + s) * 1000 + int(ms)
    except:
        return 0

def clean_text(text):
    text = re.sub(r'<[^>]+>', '', text)       
    text = re.sub(r'[\r\n]+', ' ', text)      
    text = re.sub(r'\s+', ' ', text).strip()  
    return text

def parse_and_merge_vtt(content):
    if "WEBVTT" not in content[:100]: 
        return None

    raw_lines = []
    current_start = 0
    current_end = 0
    
    for line in content.split('\n'):
        line = line.strip()
        if '-->' in line:
            try:
                times = line.split(' --> ')
                if len(times) >= 2:
                    current_start = time_to_ms(times[0].strip())
                    current_end = time_to_ms(times[1].strip().split(' ')[0])
            except:
                pass
        elif line and not line.isdigit() and line != 'WEBVTT':
            text = clean_text(line)
            
            if not text: continue
            if text.startswith('#EXT'): continue
            if text.startswith('http'): continue
            if '-->' in text: continue
            if '{' in text and '}' in text: continue 
            if 'window.' in text: continue
            if 'function(' in text: continue
            if text.startswith('Kind:'): continue
            if text.startswith('Language:'): continue
            if 'captions language' in text.lower(): continue

            if raw_lines and raw_lines[-1]['text'] == text:
                continue
                
            raw_lines.append({
                'text': text,
                'offset': current_start,
                'duration': max(0, current_end - current_start)
            })

    if not raw_lines:
        return []

    merged_lines = []
    buffer_text = ""
    buffer_start = raw_lines[0]['offset']
    buffer_duration = 0
    
    for i, item in enumerate(raw_lines):
        text = item['text']
        duration = item['duration']
        
        if buffer_text:
            buffer_text += " " + text
        else:
            buffer_text = text
            buffer_start = item['offset']
        
        buffer_duration += duration
        
        is_end_of_sentence = (
            text.endswith('.') or text.endswith('?') or text.endswith('!') or
            text.endswith('。') or text.endswith('！') or text.endswith('？')
        )
        is_long_enough = len(buffer_text) > 80
        
        time_gap = 0
        if i < len(raw_lines) - 1:
            next_start = raw_lines[i+1]['offset']
            current_end_time = item['offset'] + item['duration']
            time_gap = next_start - current_end_time

        is_big_gap = time_gap > 1000 

        if is_end_of_sentence or (is_long_enough and not is_end_of_sentence) or is_big_gap:
            merged_lines.append({
                'text': buffer_text,
                'offset': buffer_start,
                'duration': buffer_duration
            })
            buffer_text = ""
            buffer_duration = 0
            if i < len(raw_lines) - 1:
                buffer_start = raw_lines[i+1]['offset']

    if buffer_text:
        merged_lines.append({
            'text': buffer_text,
            'offset': buffer_start,
            'duration': buffer_duration
        })

    return merged_lines

def fetch_subtitle_data(video_id):
    temp_filename = f"temp_{video_id}"
    
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitlesformat': 'vtt',
        'subtitleslangs': TARGET_LANGS,
        'outtmpl': temp_filename,
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': True,
        'check_formats': False,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    }

    result_data = None
    detected_lang = None

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_id])
            
            # ファイル名から言語を特定して読み込む
            # 例: temp_ID.zh-Hans.vtt -> lang = zh-Hans
            files = glob.glob(f"{temp_filename}*.vtt")
            
            target_file = None
            if files:
                target_file = files[0]
                
                # ファイル名から言語コード抽出 (temp_ID.LANG.vtt)
                # 単純に split('.') で後ろから2番目を取る
                parts = target_file.split('.')
                if len(parts) >= 3:
                    detected_lang = parts[-2] # .vttの一つ前
                
                print(f"  [Lang] Detected: {detected_lang}")

                with open(target_file, 'r', encoding='utf-8') as f:
                    raw_content = f.read()
                
                for f in files:
                    try: os.remove(f)
                    except: pass
                
                if raw_content:
                    result_data = parse_and_merge_vtt(raw_content)
            
    except Exception as e:
        print(f"  [Error] {str(e)[:100]}")
        for f in glob.glob(f"{temp_filename}*"):
            try: os.remove(f)
            except: pass

    return result_data, detected_lang

def main():
    try:
        with open(ID_LIST_FILE, 'r', encoding='utf-8') as f:
            content = f.read().replace(',', ' ').replace('\n', ' ')
            video_ids = [vid.strip() for vid in content.split() if vid.strip()]
    except FileNotFoundError:
        print(f"Error: {ID_LIST_FILE} not found.")
        return

    print(f"Target Videos: {len(video_ids)}")
    
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS optimized_transcripts (
        video_id TEXT PRIMARY KEY,
        content JSONB,
        language TEXT
    );
    """)
    print("Table check passed.")

    success_count = 0
    skip_count = 0

    for i, vid in enumerate(video_ids):
        print(f"[{i+1}/{len(video_ids)}] Processing {vid}...", end=" ", flush=True)
        
        # ★重要★ 言語コード(language)がNULLの行、またはデータがない行だけ再取得するロジックにする
        # もし全件強制上書きしたい場合は、ここのチェックをコメントアウトしてください
        cursor.execute("SELECT 1 FROM optimized_transcripts WHERE video_id = %s AND language IS NOT NULL", (vid,))
        if cursor.fetchone():
             print("Already exists with language. Skipped.")
             continue

        subtitles, lang_code = fetch_subtitle_data(vid)
        
        if subtitles and len(subtitles) > 0:
            try:
                # languageカラムにもデータを保存
                sql = """
                INSERT INTO optimized_transcripts (video_id, content, language)
                VALUES (%s, %s, %s)
                ON CONFLICT (video_id) 
                DO UPDATE SET 
                    content = EXCLUDED.content,
                    language = EXCLUDED.language;
                """
                cursor.execute(sql, (vid, Json(subtitles), lang_code))
                print(f"Done. ({len(subtitles)} blocks, Lang: {lang_code})")
                success_count += 1
            except Exception as e:
                print(f"DB Error: {e}")
        else:
            print("No valid subtitles found.")
            skip_count += 1
        
        time.sleep(random.uniform(2, 4))

    print("\n==============================")
    print(f"Completed!")
    print(f"Success: {success_count}")
    print(f"Skipped/Failed: {skip_count}")
    print("==============================")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()