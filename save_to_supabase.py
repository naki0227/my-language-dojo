import os
import re
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

# ==========================================
# 1. .env.local の読み込み設定
# ==========================================
# カレントディレクトリにある .env.local を探します
env_path = Path('.') / '.env.local'
load_dotenv(dotenv_path=env_path)

# 環境変数の取得
# 注意: .env.local 内の変数名に合わせてここを変更してください
# Next.jsプロジェクト等の場合、接頭辞がついていることが多いです
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("エラー: .env.local から Supabase の URL または Key が読み込めませんでした。")
    print("変数名が合っているか確認してください。")
    exit(1)

# ==========================================
# 対象の動画リスト
# ==========================================
video_list = [
  { "video_id": "mNX1wpIQ4Uk", "roadmap_subject": "French" },
  { "video_id": "1Hqc9Q2ok-k", "roadmap_subject": "French" },
  { "video_id": "uomydS9kJLQ", "roadmap_subject": "French" },
  { "video_id": "C2w_zVN8XLk", "roadmap_subject": "French" },
  { "video_id": "Zb5R6xXMfa0", "roadmap_subject": "French" },
  { "video_id": "MrsC3GCo9vs", "roadmap_subject": "French" }
]

def init_supabase() -> Client:
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Supabaseへの接続初期化エラー: {e}")
        exit(1)

def clean_text(transcript_data):
    """字幕リストを整った1つの文章にする"""
    text_segments = [line['text'] for line in transcript_data]
    full_text = " ".join(text_segments)
    
    # 改行をスペースに、連続する空白を1つに
    full_text = full_text.replace("\n", " ")
    full_text = re.sub(r'\s+', ' ', full_text)
    
    return full_text.strip()

def process_videos():
    supabase = init_supabase()
    print(f"Supabaseに接続しました: {SUPABASE_URL}")
    print("処理を開始します...")

    for item in video_list:
        video_id = item["video_id"]
        subject = item["roadmap_subject"]
        
        print(f"--- 処理中: {video_id} ---")

        transcript_obj = None
        is_auto = False

        try:
            # --- 字幕取得ロジック ---
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # 1. 手動字幕 (fr, fr-orig)
            try:
                transcript_obj = transcript_list.find_manually_created_transcript(['fr', 'fr-orig'])
                print("  -> 手動作成の字幕が見つかりました。")
            except NoTranscriptFound:
                # 2. 自動字幕 (fr)
                try:
                    transcript_obj = transcript_list.find_generated_transcript(['fr'])
                    is_auto = True
                    print("  -> 自動生成の字幕が見つかりました。")
                except NoTranscriptFound:
                    print("  -> [スキップ] フランス語の字幕が見つかりません。")
                    continue

            # --- 整形と保存 ---
            if transcript_obj:
                fetched_data = transcript_obj.fetch()
                cleaned_text = clean_text(fetched_data)
                
                data = {
                    "video_id": video_id,
                    "roadmap_subject": subject,
                    "full_text": cleaned_text,
                    "is_auto_generated": is_auto
                }

                # Upsert実行
                supabase.table("video_transcripts").upsert(data).execute()
                print(f"  -> 保存完了 (文字数: {len(cleaned_text)})")

        except TranscriptsDisabled:
            print("  -> [エラー] 字幕機能が無効です。")
        except Exception as e:
            print(f"  -> [エラー] 予期せぬエラー: {str(e)}")

    print("\n完了しました。")

if __name__ == "__main__":
    process_videos()