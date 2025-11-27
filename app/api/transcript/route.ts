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
export const maxDuration = 60;

const LANG_MAP: Record<string, string> = {
    ja: 'Japanese', en: 'English', zh: 'Chinese (Simplified)', ko: 'Korean',
    pt: 'Portuguese', ar: 'Arabic', ru: 'Russian', es: 'Spanish', fr: 'French',
};

// デモ動画用バックアップ (通信エラー時の保険)
const FALLBACK_TRANSCRIPTS: Record<string, any[]> = {
    'arj7oStGLkU': [
        { text: "So in college, I was a government major, which means I had to write a lot of papers.", offset: 1000, duration: 6000 },
        { text: "Now, when a normal student writes a paper, they might spread the work out a little like this.", offset: 7000, duration: 7000 },
        { text: "So, you know -- you get started a little bit.", offset: 14000, duration: 2000 },
        { text: "You do a little bit more the next day.", offset: 17000, duration: 2000 },
        { text: "And I had a plan like this.", offset: 20000, duration: 4000 },
        { text: "I was ready to go.", offset: 22000, duration: 2000 },
        { text: "But then, actually, the paper would come along,", offset: 24000, duration: 3000 },
        { text: "and then I would kind of do this.", offset: 27000, duration: 3000 },
        { text: "And that would happen every single paper.", offset: 30000, duration: 3000 },
    ],
    'UF8uR6Z6KLc': [
        { text: "I am honored to be with you today at your commencement from one of the finest universities in the world.", offset: 1000, duration: 8000 },
        { text: "I never graduated from college. Truth be told, this is the closest I've ever gotten to a college graduation.", offset: 10000, duration: 9000 },
    ]
};

const mergeData = (englishData: any[], translations: string[]) => {
    return englishData.map((item, index) => ({
        ...item,
        translation: translations[index] || ""
    }));
};

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
    const code = searchParams.get('lang') || 'en';
    const targetLangName = LANG_MAP[code] || 'English';

    if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 });

    // デモ動画特例
    //if (FALLBACK_TRANSCRIPTS[videoId]) {
    //    console.log(`[API] Demo video detected (${videoId}). Returning static data.`);
    //    const staticData = FALLBACK_TRANSCRIPTS[videoId].map(l => ({ ...l, translation: "" }));
    //    return NextResponse.json(staticData);
    //}

    try {
        // 1. キャッシュ確認
        if (code !== 'en') {
            const { data: translationData } = await adminSupabase.from('localized_translations').select('translations').match({ video_id: videoId, language: code }).single();
            if (translationData) {
                const { data: masterData } = await adminSupabase.from('optimized_transcripts').select('content').eq('video_id', videoId).single();
                if (masterData) return NextResponse.json(mergeData(masterData.content, translationData.translations));
            }
        } else {
            const { data: masterDataEn } = await adminSupabase.from('optimized_transcripts').select('content').eq('video_id', videoId).single();
            if (masterDataEn) return NextResponse.json(masterDataEn.content.map((l: any) => ({ ...l, translation: "" }))
            );
        }

        // 2. 字幕取得 (YouTubeへアクセス)
        let rawLines: any[] = [];

        try {
            // Plan A: youtube-transcript
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            // @ts-ignore
            rawLines = transcript.map((t: any) => ({ text: t.text, offset: Math.floor(t.offset), duration: Math.floor(t.duration) }));
        } catch (errA) {
            try {
                // Plan B: youtubei.js
                const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
                const info = await youtube.getInfo(videoId);
                const transcriptData = await info.getTranscript();
                if (transcriptData?.transcript?.content?.body?.initial_segments) {
                    // @ts-ignore
                    rawLines = transcriptData.transcript.content.body.initial_segments.map((segment: any) => ({
                        text: segment.snippet.text,
                        offset: parseInt(segment.start_ms),
                        duration: parseInt(segment.end_ms) - parseInt(segment.start_ms)
                    }));
                }
            } catch (errB) {
                console.error('[API] All fetch plans failed.', errB);
                // 取得失敗時は、AI処理をスキップしてダミーを出すパスへ
            }
        }

        // 4. AI整形・翻訳
        if (rawLines.length === 0) {
            console.warn('[API] Returning NO CAPTIONS message.');
            return NextResponse.json([
                { text: "⚠️ 字幕データが見つかりませんでした。", offset: 0, duration: 4000, translation: "" },
            ], { status: 200 });
        }

        // AI整形・翻訳の実行
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        // 長すぎる場合はAIスキップ
        if (rawLines.length > 2000 && code === 'en') {
            const safeData = rawLines.map(l => ({ ...l, translation: "" }));
            await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: safeData });
            return NextResponse.json(safeData);
        }

        const chunks = chunkArray(rawLines, 50);
        let finalFormatted: any[] = [];
        let finalTranslation: any[] = [];

        try {
            for (const chunk of chunks) {
                const prompt = `
              You are a professional subtitle editor.
              1. **Combine fragmented words into natural, complete sentences.** (Most Important)
              2. ${code === 'en' ? 'Do not translate, just return the corrected English sentences in the "text" field.' : `Translate the corrected sentences into "${targetLangName}" and put it in the "translation" field.`}
              3. Maintain the approximate timestamp.
              
              Raw Input: ${JSON.stringify(chunk)}
              Output Format (JSON Array): [ { "text": "Corrected English", "translation": "${code === 'en' ? '' : 'Translated'}", "offset": 123, "duration": 456 } ]
            `;
                const result = await model.generateContent(prompt);
                const chunkData = JSON.parse(result.response.text());

                chunkData.forEach((item: any) => {
                    finalFormatted.push({ text: item.text, offset: item.offset, duration: item.duration });
                    finalTranslation.push(item.translation);
                });
            }

            // 5. 保存
            await adminSupabase.from('optimized_transcripts').upsert({ video_id: videoId, content: finalFormatted });
            if (code !== 'en') {
                await adminSupabase.from('localized_translations').upsert({ video_id: videoId, language: code, translations: finalTranslation }, { onConflict: 'video_id, language' });
            }

            return NextResponse.json(finalFormatted.map((item, index) => ({ ...item, translation: finalTranslation[index] || "" })));

        } catch (aiError) {
            console.warn('[API] AI processing failed, returning raw data:', aiError);
            return NextResponse.json(rawLines.map(l => ({ ...l, translation: "" })));
        }

    } catch (error) {
        console.error('[API] Fatal Error:', error);
        return NextResponse.json([], { status: 500 });
    }
}