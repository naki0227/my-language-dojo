import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
    try {
        const { message, userId } = await request.json();

        const { data: profile } = await adminSupabase.from('profiles').select('*').eq('id', userId).single();
        const { data: testResult } = await adminSupabase.from('test_results').select('score, level_result').eq('user_id', userId).order('taken_at', { ascending: false }).limit(1).single();

        const targetLanguage = profile?.learning_target || 'English';

        // Gemini 3.0 Pro (or Flash)
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        const systemPrompt = `
      You are "Dojo Master", an AI study advisor for ${targetLanguage}.
      
      User Profile:
      - Target: ${targetLanguage}
      - Level: ${testResult?.level_result || 'Unknown'}
      
      User's Message: "${message}"
      
      Instructions:
      1. Give advice about learning ${targetLanguage}.
      2. If the user asks for recommendations, generate a simple keyword to search the INTERNAL DATABASE.
         - Keyword should be in English or the target language.
         - Example: "Business", "Greeting", "Grammar"
      3. Respond in Japanese.
      
      Output Format (JSON):
      {
        "reply": "Advice here.",
        "searchKeyword": "Keyword" (Optional)
      }
    `;

        const result = await model.generateContent(systemPrompt);
        const aiResponse = JSON.parse(result.response.text());

        let recommendedVideos: any[] = [];

        // ★修正: YouTubeではなく、自分のDB (library_videos) から検索
        if (aiResponse.searchKeyword) {
            try {
                // 1. ライブラリから検索
                const { data: videos } = await adminSupabase
                    .from('library_videos')
                    .select('video_id, title, thumbnail_url')
                    .ilike('title', `%${aiResponse.searchKeyword}%`)
                    .limit(3);

                if (videos && videos.length > 0) {
                    recommendedVideos = videos.map(v => ({
                        id: v.video_id,
                        title: v.title,
                        thumbnail: v.thumbnail_url
                    }));
                } else {
                    // ヒットしなければ、その言語の動画をランダムに提案 (フォールバック)
                    // ※ subjectカラムがない古いデータも考慮して検索条件は緩めに
                    const { data: randomVideos } = await adminSupabase
                        .from('library_videos')
                        .select('video_id, title, thumbnail_url')
                        .limit(3);

                    if (randomVideos) {
                        recommendedVideos = randomVideos.map(v => ({
                            id: v.video_id,
                            title: v.title,
                            thumbnail: v.thumbnail_url
                        }));
                        aiResponse.reply += "\n(検索条件に合う動画が見つからなかったので、人気の動画を表示します)";
                    }
                }
            } catch (dbError) {
                console.error('DB Search Error:', dbError);
            }
        }

        return NextResponse.json({ reply: aiResponse.reply, videos: recommendedVideos });

    } catch (error) {
        console.error('Chat Error:', error);
        return NextResponse.json({ error: 'AI is sleeping...' }, { status: 500 });
    }
}


