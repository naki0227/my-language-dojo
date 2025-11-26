import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { YoutubeTranscript } from 'youtube-transcript';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // 3分に延長

// チャンク分割ヘルパー
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

export async function POST(request: Request) {
    const { videoIds } = await request.json(); // IDの配列を受け取る

    if (!videoIds || videoIds.length === 0) {
        return NextResponse.json({ error: 'No video IDs provided' }, { status: 400 });
    }

    const results = [];
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

    for (const videoId of videoIds) {
        let rawLines: any[] = [];

        // 1. YouTubeから字幕取得 (Plan A のみで試行)
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            rawLines = transcript.map((t: any) => ({
                text: t.text,
                offset: Math.floor(t.offset),
                duration: Math.floor(t.duration)
            }));
        } catch (e) {
            // 取得失敗
            results.push({ videoId, status: 'Failed', message: 'Fetch failed (no captions or blocked)' });
            continue;
        }

        // 2. AI整形
        if (rawLines.length > 0) {
            try {
                const chunks = chunkArray(rawLines, 50);
                let finalFormatted: any[] = [];

                for (const chunk of chunks) {
                    const prompt = `
                  You are a professional subtitle editor.
                  1. **Combine fragmented words into natural, complete English sentences.**
                  2. Do NOT translate.
                  3. Maintain the approximate timestamp.
                  Raw Input: ${JSON.stringify(chunk)}
                  Output Format (JSON Array): [ { "text": "Corrected English Sentence", "offset": 123, "duration": 456 } ]
                `;
                    const result = await model.generateContent(prompt);
                    const chunkData = JSON.parse(result.response.text());
                    finalFormatted = [...finalFormatted, ...chunkData];
                }

                // 3. 英語マスターとして保存
                await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: finalFormatted });
                results.push({ videoId, status: 'Success', message: 'Master created and saved.' });

            } catch (aiError) {
                // AIエラー時は生データのみ保存
                await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: rawLines.map(l => ({ ...l, translation: "" })) });
                results.push({ videoId, status: 'AI Error', message: 'Saved raw data due to AI failure.' });
            }
        } else {
            results.push({ videoId, status: 'No Data', message: 'Fetched 0 lines.' });
        }
    }

    return NextResponse.json({ success: true, results: results });
}