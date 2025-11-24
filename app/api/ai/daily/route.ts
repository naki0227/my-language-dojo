import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
    try {
        console.log('[API] Auto-selecting daily content...');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        // 1. テーマ決定
        const topicPrompt = `
      Suggest ONE interesting English learning topic for today.
      Output ONLY the topic (e.g. "Difference between Make and Do").
    `;
        const topicResult = await model.generateContent(topicPrompt);
        const topic = topicResult.response.text().trim();

        // 2. YouTube検索
        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        const search = await youtube.search(`English lesson ${topic}`);
        const video = search.videos[0];
        if (!video) throw new Error('No video found');

        // @ts-ignore
        const v = video as any;
        const videoTitle = v.title?.text || v.title?.toString() || topic;
        const videoId = v.id;

        // 3. メッセージ & クイズ生成 (JSONで出力させる)
        const contentPrompt = `
      You are an English teacher.
      Based on the topic "${topic}" and video title "${videoTitle}", generate daily content.

      Please output a JSON object with the following fields:
      1. "message": A short, encouraging message for users in Japanese (max 100 chars).
      2. "quiz": An array of 3 multiple-choice questions related to this topic.
         Each question object must have:
         - "q": Question text (Japanese)
         - "options": Array of 4 strings (English or Japanese)
         - "answer": Index of the correct option (0-3)
         - "explanation": Short explanation in Japanese.

      Output ONLY the JSON string. No markdown code blocks.
    `;

        const result = await model.generateContent(contentPrompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);

        return NextResponse.json({
            videoId,
            topic,
            message: data.message,
            quiz: data.quiz
        });

    } catch (error) {
        console.error('[API] Daily Gen Error:', error);
        return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
    }
}


