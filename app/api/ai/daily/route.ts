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

export async function POST(request: Request) {
    try {
        const { subject } = await request.json();
        const targetSubject = subject || 'English';

        // Gemini 3.0 Pro
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // 1. トピック決定
        const topicPrompt = `Suggest ONE interesting, specific ${targetSubject} learning topic for "Today's Pick". Output ONLY the topic.`;
        const topicResult = await model.generateContent(topicPrompt);
        const topic = topicResult.response.text().trim();

        // 2. YouTube検索 (Admin権限で実行)
        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        const search = await youtube.search(`${targetSubject} lesson ${topic}`);
        const video = search.videos[0];

        if (!video) throw new Error('No video found');
        const v = video as any;
        const videoTitle = v.title?.text || v.title?.toString() || topic;
        const videoId = v.id;

        // ★追加: 字幕をここで事前取得して保存しておく (Pre-fetch)
        try {
            console.log(`[Daily] Pre-fetching transcript for ${videoId}...`);
            // youtube-transcript で取得
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            const rawLines = transcript.map((t: any) => ({
                text: t.text,
                offset: Math.floor(t.offset),
                duration: Math.floor(t.duration)
            }));

            if (rawLines.length > 0) {
                // 整形なしの生データとして保存 (表示の安定性優先)
                // 英語マスターデータとして保存
                await adminSupabase.from('optimized_transcripts').upsert({
                    video_id: videoId,
                    content: rawLines
                }, { onConflict: 'video_id' });
                console.log(`[Daily] Transcript saved for ${videoId}`);
            }
        } catch (e) {
            console.error('[Daily] Transcript pre-fetch failed (will try on client side later):', e);
        }

        // 3. メッセージ & クイズ生成
        const contentPrompt = `
      You are a teacher of ${targetSubject}.
      Topic: "${topic}", Video: "${videoTitle}".

      Output JSON:
      {
        "message": "Short catchy message in Japanese (max 100 chars).",
        "quiz": [
           { "q": "Question (JP)", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "Exp (JP)" },
           { "q": "Question (JP)", "options": ["A", "B", "C", "D"], "answer": 1, "explanation": "Exp (JP)" },
           { "q": "Question (JP)", "options": ["A", "B", "C", "D"], "answer": 2, "explanation": "Exp (JP)" }
        ]
      }
      Output ONLY JSON.
    `;

        const result = await model.generateContent(contentPrompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);

        return NextResponse.json({ videoId, topic, message: data.message, quiz: data.quiz });

    } catch (error) {
        console.error('[API] Daily Gen Error:', error);
        return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
    }
}


