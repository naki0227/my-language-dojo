import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        console.log('[API] Auto-selecting daily content...');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        // 1. 今日のテーマをランダムに決定
        const topicPrompt = `
      Suggest ONE interesting, specific English learning topic for "Today's Pick".
      It can be about grammar, idioms, culture, pronunciation, or a famous speech.
      Output ONLY the topic (e.g. "Difference between Make and Do", "Steve Jobs Speech").
    `;
        const topicResult = await model.generateContent(topicPrompt);
        const topic = topicResult.response.text().trim();
        console.log(`[API] Topic: ${topic}`);

        // 2. YouTube検索
        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        const search = await youtube.search(`English lesson ${topic}`);

        const video = search.videos[0];
        if (!video) throw new Error('No video found');

        // ★修正箇所: 'as any' で型チェックを回避
        const v = video as any;

        // タイトルを安全に取得
        const videoTitle = v.title?.text || v.title?.toString() || topic;
        const videoId = v.id;

        // 3. 紹介メッセージ生成
        const msgPrompt = `
      You are an enthusiastic English teacher.
      Write a short, catchy "Today's Message" for users about this video.
      
      Topic: ${topic}
      Video Title: ${videoTitle}
      
      Requirements:
      - Japanese language.
      - Encourage users to watch it.
      - Max 100 characters.
      - Output ONLY the message.
    `;
        const msgResult = await model.generateContent(msgPrompt);
        const message = msgResult.response.text().trim();

        return NextResponse.json({ videoId, message, topic });

    } catch (error) {
        console.error('[API] Daily Gen Error:', error);
        return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
    }
}


