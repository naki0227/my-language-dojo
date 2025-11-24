import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

// キャッシュ無効化設定
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
    try {
        let { topic, category } = await request.json();
        console.log(`[API] Generating textbook for: ${category} / ${topic || 'AUTO'}`);

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        // 1. トピック自動決定
        if (!topic) {
            console.log('[API] Auto-generating topic...');
            const topicPrompt = `
        You are an expert English curriculum designer.
        Suggest ONE interesting, specific, and educational topic for an English textbook.
        Target Category: "${category}" (jhs=Junior High, hs=High School, business=Business, eiken=Eiken Exam, column=Trivia)
        
        Requirements:
        - Output ONLY the topic title in Japanese.
      `;
            const topicResult = await model.generateContent(topicPrompt);
            topic = topicResult.response.text().trim();
            console.log(`[API] Topic decided: ${topic}`);
        }

        // 2. YouTube動画を自動検索
        let videoInfo = null;
        try {
            console.log('[API] Searching YouTube...');
            const youtube = await Innertube.create({
                cache: new UniversalCache(false),
                generate_session_locally: true,
            });

            let searchQuery = `英語 ${topic} 解説`;
            if (category === 'business') searchQuery = `business english ${topic}`;
            if (category === 'eiken') searchQuery = `英検 ${topic} 対策`;

            const search = await youtube.search(searchQuery);
            const video = search.videos[0];

            if (video) {
                // ★修正箇所: TypeScriptの厳格なチェックを 'as any' で回避
                const v = video as any;

                videoInfo = {
                    id: v.id,
                    // タイトルがオブジェクトだったり文字列だったりするので安全に取得
                    title: v.title?.text || v.title?.toString() || topic,
                };
                console.log(`[API] Found video: ${videoInfo.title}`);
            }
        } catch (ytError) {
            console.error('[API] YouTube Search Warning:', ytError);
            // エラーでも続行
        }

        // 3. 教科書本文生成
        console.log('[API] Writing content...');
        let contentPrompt = `
      You are an expert English teacher.
      Please write a textbook content in Markdown format about "${topic}".
      The target audience is "${category}" level students.

      # Requirements:
      1. Title should be engaging and start with Level 1 Header (# ).
      2. Explain clearly with examples.
      3. Language: Japanese.
    `;

        if (videoInfo) {
            contentPrompt += `
      4. I found a relevant YouTube video: "${videoInfo.title}" (ID: ${videoInfo.id}).
         Please insert this video into the text using this format:
         [[video:${videoInfo.id}:0:${videoInfo.title}]]
         Add a brief sentence introducing it.
      `;
        } else {
            contentPrompt += `
      4. Use "[[video:VIDEO_ID:START_SECONDS:TITLE]]" as a placeholder.
      `;
        }

        contentPrompt += `\nOutput ONLY the Markdown content.`;

        const result = await model.generateContent(contentPrompt);
        const text = result.response.text();

        return NextResponse.json({ content: text, generatedTopic: topic });

    } catch (error) {
        console.error('[API] Fatal Error:', error);
        return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
    }
}


