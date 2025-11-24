import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
    try {
        const { message, userId } = await request.json();

        // 1. ユーザー情報を収集
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        const { data: testResult } = await adminSupabase
            .from('test_results')
            .select('score, level_result')
            .eq('user_id', userId)
            .order('taken_at', { ascending: false })
            .limit(1)
            .single();

        // 2. プロンプト作成 (JSON出力モード)
        const systemPrompt = `
      You are "Dojo Master", an AI English study advisor.
      
      User Profile:
      - Level: ${testResult?.level_result || 'Unknown'}
      - Goal: ${profile?.goal || 'Not set'}
      
      User's Message: "${message}"
      
      Instructions:
      1. Analyze the user's request.
      2. If the user asks for video recommendations (e.g., "おすすめは？", "Recommend something"), YOU MUST generate a YouTube search query to find suitable videos.
      3. Respond in Japanese.
      
      Output Format (JSON):
      {
        "reply": "Your friendly advice or introduction to the videos.",
        "searchQuery": "English learning video for ${testResult?.level_result || 'beginners'} ${profile?.goal || ''}" (Optional: Only if recommending videos)
      }
    `;

        // 3. Gemini呼び出し
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro', generationConfig: { responseMimeType: "application/json" } });

        const result = await model.generateContent(systemPrompt);
        const aiResponse = JSON.parse(result.response.text());

        let recommendedVideos: any[] = [];

        // 4. もしAIが検索クエリを出したら、実際にYouTubeを検索する
        if (aiResponse.searchQuery) {
            try {
                const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
                const search = await youtube.search(aiResponse.searchQuery);

                // 上位3件を取得
                recommendedVideos = search.videos.slice(0, 3).map((v: any) => ({
                    id: v.id,
                    title: v.title?.text || v.title?.toString() || 'No Title',
                    thumbnail: v.thumbnails?.[0]?.url || ''
                }));
            } catch (ytError) {
                console.error('YouTube Search Error:', ytError);
            }
        }

        return NextResponse.json({
            reply: aiResponse.reply,
            videos: recommendedVideos
        });

    } catch (error) {
        console.error('Chat Error:', error);
        return NextResponse.json({ error: 'AI is sleeping...' }, { status: 500 });
    }
}


