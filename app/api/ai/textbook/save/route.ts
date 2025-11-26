import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
    try {
        let { topic, category, targetSubject } = await request.json();
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        // ★修正: 安定の 1.5-flash
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        if (!topic) {
            const topicPrompt = `Suggest ONE interesting ${targetSubject} topic for ${category}. Output ONLY topic.`;
            const res = await model.generateContent(topicPrompt);
            topic = res.response.text().trim();
        }

        let videoInfo = null;
        try {
            // YouTube検索 (省略)
        } catch (e) { }

        const contentPrompt = `
      Write a textbook lesson about "${topic}" for ${targetSubject} (${category}).
      Language: Japanese.
      Output ONLY Markdown.
    `;
        const result = await model.generateContent(contentPrompt);
        const text = result.response.text();

        return NextResponse.json({ content: text, generatedTopic: topic });

    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}