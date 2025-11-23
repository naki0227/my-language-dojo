// app/api/transcript/route.ts
import { NextResponse } from 'next/server';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    try {
        console.log(`Fetching transcript for: ${videoId}`);

        // YouTubeクライアントの初期化
        const youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
        });

        // 動画情報の取得
        const info = await youtube.getInfo(videoId);

        // 字幕データの取得を試みる
        try {
            const transcriptData = await info.getTranscript();

            // データ構造をアプリ用に変換
            // youtubei.jsのデータはセグメントごとに分かれているので整形する
            // @ts-ignore
            const formattedTranscript = transcriptData.transcript.content.body.initial_segments.map((segment: any) => {
                const text = segment.snippet.text;
                const startMs = parseInt(segment.start_ms);
                const endMs = parseInt(segment.end_ms);

                return {
                    text: text,
                    offset: startMs,
                    duration: endMs - startMs
                };
            });

            return NextResponse.json(formattedTranscript);

        } catch (transcriptError) {
            console.error('No transcript found via getTranscript:', transcriptError);
            return NextResponse.json({ error: 'No subtitles available for this video.' }, { status: 404 });
        }

    } catch (error) {
        console.error('General YouTube API Error:', error);
        return NextResponse.json({ error: 'Failed to process video information' }, { status: 500 });
    }
}
