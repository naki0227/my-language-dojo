import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { YoutubeTranscript } from 'youtube-transcript';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 処理時間を長く確保

// チャンク分割ヘルパー
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    // このAPIは「保存」が主目的なので、言語指定がなければ 'en' (マスターデータ作成) とする
    const code = searchParams.get('lang') || 'en';

    if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 });

    try {
        // 1. 既にDBにあるか確認 (あればそれを返すだけで終了)
        const { data: masterData } = await adminSupabase
            .from('optimized_transcripts')
            .select('content')
            .eq('video_id', videoId)
            .single();

        if (masterData) {
            console.log('[API] Transcript already exists in DB.');
            return NextResponse.json(masterData.content);
        }

        // 2. なければ新規取得 (YouTubeから)
        let rawLines: any[] = [];
        console.log(`[API] Fetching raw transcript for ${videoId}...`);

        try {
            // Plan A
            // @ts-ignore
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            rawLines = transcript.map((t: any) => ({
                text: t.text,
                offset: Math.floor(t.offset),
                duration: Math.floor(t.duration)
            }));
        } catch (errA) {
            try {
                // Plan B
                const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true, lang: 'en', location: 'US' });
                const info = await youtube.getInfo(videoId);
                const transcriptData = await info.getTranscript();
                // @ts-ignore
                if (transcriptData?.transcript?.content?.body?.initial_segments) {
                    // @ts-ignore
                    rawLines = transcriptData.transcript.content.body.initial_segments.map((segment: any) => ({
                        text: segment.snippet.text,
                        offset: parseInt(segment.start_ms),
                        duration: parseInt(segment.end_ms) - parseInt(segment.start_ms)
                    }));
                }
            } catch (errB) {
                console.error('[API] All fetch plans failed.');
                return NextResponse.json([], { status: 200 });
            }
        }

        if (rawLines.length === 0) return NextResponse.json([], { status: 200 });

        // 3. AIによる整形 (英語マスターデータの作成)
        // 長すぎる場合は生データを保存
        if (rawLines.length > 2000) {
            const safeData = rawLines.map(l => ({ text: l.text, offset: l.offset, duration: l.duration }));
            await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: safeData });
            return NextResponse.json(safeData);
        }

        // AI整形実行
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        const chunks = chunkArray(rawLines, 50);
        let finalFormatted: any[] = [];

        try {
            for (const chunk of chunks) {
                const prompt = `
              You are a professional subtitle editor.
              Combine fragmented words into natural, complete English sentences.
              Maintain the approximate timestamp.
              Raw Input: ${JSON.stringify(chunk)}
              Output Format (JSON Array): [ { "text": "Corrected Sentence", "offset": 123, "duration": 456 } ]
            `;

                const result = await model.generateContent(prompt);
                const chunkData = JSON.parse(result.response.text());
                finalFormatted = [...finalFormatted, ...chunkData];
            }

            // 保存 (マスターデータ)
            await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: finalFormatted });

            return NextResponse.json(finalFormatted);

        } catch (aiError) {
            console.warn('[API] AI Processing Failed (Fallback to raw):', aiError);
            // 失敗時は生データを保存
            const safeData = rawLines.map(l => ({ text: l.text, offset: l.offset, duration: l.duration }));
            await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: safeData });
            return NextResponse.json(safeData);
        }

    } catch (error) {
        console.error('[API] Fatal Error:', error);
        return NextResponse.json([], { status: 200 });
    }
}