import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ★修正: 言語コードを正式な英語名に変換するマップ
const LANG_MAP: Record<string, string> = {
    ja: 'Japanese',
    en: 'English',
    zh: 'Chinese (Simplified)',
    ko: 'Korean',
    pt: 'Portuguese',
    ar: 'Arabic',
    ru: 'Russian',
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const code = searchParams.get('lang') || 'ja';

    // ここでコード(zh)を名前(Chinese)に変換。なければそのまま渡す。
    const targetLangName = LANG_MAP[code] || 'Japanese';

    if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 });

    try {
        // 1. キャッシュ確認 (言語コードで検索)
        const { data: cached } = await adminSupabase
            .from('cached_subtitles')
            .select('content')
            .match({ video_id: videoId, language: code })
            .single();

        if (cached) {
            return NextResponse.json(cached.content);
        }

        // 2. YouTubeから取得
        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        const info = await youtube.getInfo(videoId);
        const transcriptData = await info.getTranscript();

        // @ts-ignore
        const rawLines = transcriptData.transcript.content.body.initial_segments.map((segment: any) => ({
            text: segment.snippet.text,
            offset: parseInt(segment.start_ms),
            duration: parseInt(segment.end_ms) - parseInt(segment.start_ms)
        }));

        if (rawLines.length > 500) return NextResponse.json(rawLines);

        // 3. AI翻訳
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        // ★修正: プロンプトから (Japanese) を削除し、動的な言語名を渡す
        const prompt = `
      You are a professional subtitle editor and translator.
      I will provide a raw YouTube transcript JSON.
      
      Please do the following:
      1. Combine fragmented words into proper, natural sentences.
      2. Translate each sentence into "${targetLangName}".
      3. Keep the approximate "offset" (start time) of the first word in the sentence.
      4. Return a JSON array.

      Raw Input:
      ${JSON.stringify(rawLines)}

      Output Format (JSON only):
      [
        { "text": "Original English sentence.", "translation": "Translated sentence in ${targetLangName}", "offset": 1234, "duration": 5000 }
      ]
    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json|```/g, '').trim();
        const aiData = JSON.parse(responseText);

        // 4. 保存
        await adminSupabase.from('cached_subtitles').insert({
            video_id: videoId,
            language: code,
            content: aiData
        });

        return NextResponse.json(aiData);

    } catch (error) {
        console.error('[API] Error:', error);
        return NextResponse.json({ error: 'Failed to process transcript' }, { status: 500 });
    }
}


