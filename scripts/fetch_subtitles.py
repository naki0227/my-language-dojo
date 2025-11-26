import sys
import json
import re

# yt_dlp (推奨) または youtube_dl をインポート
try:
    from yt_dlp import YoutubeDL
except ImportError:
    try:
        from youtube_dl import YoutubeDL
    except ImportError:
        print(json.dumps([{"error": "yt-dlp or youtube-dl python library is not installed."}]))
        sys.exit(1)

def time_to_ms(t_str):
    """ '00:00:01.234' 形式の文字列をミリ秒に変換 """
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

def parse_vtt(content):
    """ WebVTT形式の字幕テキストをパースして辞書リストにする """
    lines = []
    current_start = 0
    current_end = 0
    
    for line in content.split('\n'):
        line = line.strip()
        if '-->' in line:
            # タイムスタンプ行: "00:00:01.000 --> 00:00:03.000 align:start ..."
            try:
                times = line.split(' --> ')
                if len(times) >= 2:
                    current_start = time_to_ms(times[0].strip())
                    # 終了時間の後ろに設定情報がつくことがあるのでスペースで切る
                    current_end = time_to_ms(times[1].strip().split(' ')[0])
            except:
                pass
        elif line and not line.isdigit() and line != 'WEBVTT':
            # 字幕テキスト行 (タグ除去)
            text = re.sub(r'<[^>]+>', '', line).strip()
            # 重複や空行を除外
            if text and (not lines or lines[-1]['text'] != text):
                lines.append({
                    'text': text,
                    'offset': current_start,
                    'duration': max(0, current_end - current_start)
                })
    return lines

def fetch_single_video(video_id):
    """ 1つの動画IDの字幕を取得する """
    ydl_opts = {
        'writesubtitles': True,
        'writeautomaticsub': True, # 自動生成字幕も取得
        'subtitleslangs': ['en'],  # 英語のみ対象
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(video_id, download=False)
            except Exception:
                return {'videoId': video_id, 'success': False, 'error': 'Video not found or unavailable'}

            caption_url = None
            
            # 1. 手動アップロード字幕 (en) を探す
            if 'subtitles' in info and 'en' in info['subtitles']:
                # vtt形式を優先
                for sub in info['subtitles']['en']:
                    if sub.get('ext') == 'vtt':
                        caption_url = sub['url']
                        break
                # なければ最初に見つかったもの
                if not caption_url and info['subtitles']['en']:
                    caption_url = info['subtitles']['en'][0]['url']

            # 2. なければ自動生成字幕 (en) を探す
            if not caption_url and 'automatic_captions' in info and 'en' in info['automatic_captions']:
                for sub in info['automatic_captions']['en']:
                    if sub.get('ext') == 'vtt':
                        caption_url = sub['url']
                        break
                if not caption_url and info['automatic_captions']['en']:
                    caption_url = info['automatic_captions']['en'][0]['url']

            if caption_url:
                # 字幕データをダウンロードしてパース
                sub_content = ydl.urlopen(caption_url).read().decode('utf-8')
                raw_lines = parse_vtt(sub_content)
                
                if raw_lines:
                    return {'videoId': video_id, 'success': True, 'rawLines': raw_lines}
                else:
                    return {'videoId': video_id, 'success': False, 'error': 'Subtitle content was empty'}
            else:
                return {'videoId': video_id, 'success': False, 'error': 'No English subtitles found'}

    except Exception as e:
        return {'videoId': video_id, 'success': False, 'error': str(e)}

if __name__ == "__main__":
    # 引数からIDリストを取得 (スペース区切りを想定)
    # 例: python scripts/fetch_subtitles.py id1 id2 id3
    input_ids = []
    for arg in sys.argv[1:]:
        # カンマ区切りなどが混ざっていても対応できるように分解
        parts = arg.replace(',', ' ').split()
        input_ids.extend(parts)

    if not input_ids:
        # IDがない場合は空リストを返す
        print(json.dumps([]))
        sys.exit(0)

    results = []
    for vid in input_ids:
        result = fetch_single_video(vid)
        results.append(result)

    # 結果をJSON配列として標準出力に出力
    print(json.dumps(results, ensure_ascii=False))