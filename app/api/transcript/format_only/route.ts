import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ★修正: 外部にあったヘルパー関数を内部に移動
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

export async function POST(request: Request) {
    try {
        // rawLinesをそのまま取得
        const { videoId, rawLines } = await request.json();

        if (!videoId || !rawLines || rawLines.length === 0) {
            return NextResponse.json({ error: 'Missing transcript data' }, { status: 400 });
        }

        // AI整形 (Flashモデルを使用)
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        const chunks = chunkArray(rawLines, 50);
        let finalFormatted: any[] = [];

        for (const chunk of chunks) {
            const prompt = `
          You are a professional subtitle editor.
          1. **Combine fragmented words into natural, complete English sentences.** (Must maintain exact sentence order)
          2. Do NOT translate.
          3. Keep the approximate timestamp (offset) of the start of the original segment.
          
          Raw Input: ${JSON.stringify(chunk)}
          Output Format (JSON Array): [ { "text": "Corrected English Sentence.", "offset": 1234, "duration": 5000 } ]
        `;
            const result = await model.generateContent(prompt);
            // ★修正: 厳密なJSONパース
            const jsonString = result.response.text().replace(/```json|```/g, '').trim();
            const chunkData = JSON.parse(jsonString);

            chunkData.forEach((item: any) => {
                finalFormatted.push({ text: item.text, offset: item.offset, duration: item.duration });
            });
        }

        // 英語マスターを保存
        await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: finalFormatted });

        return NextResponse.json({ success: true, count: finalFormatted.length, message: "Master transcript saved." });

    } catch (error: any) {
        console.error('[API] Formatting Error:', error);
        // ★エラー時に500を返すことで、フロントエンドのバッチ処理が失敗を認識できるようにする
        return NextResponse.json({ error: `Formatting Failed: ${error.message}` }, { status: 500 });
    }
}