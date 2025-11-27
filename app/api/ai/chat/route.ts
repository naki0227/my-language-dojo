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

        // 1. ユーザーのプラン確認
        const { data: profile } = await adminSupabase.from('profiles').select('*').eq('id', userId).single();
        const isPro = profile?.is_pro || false;

        // 2. 検問: 利用制限チェック (Freeプランのみ)
        if (!isPro) {
            const today = new Date().toISOString().split('T')[0];
            const LIMIT = 5; // 1日5回まで

            // 今日の利用回数を取得
            const { data: usage } = await adminSupabase
                .from('ai_usage_logs')
                .select('id, count')
                .match({ user_id: userId, date: today, feature: 'chat' })
                .single();

            const currentCount = usage?.count || 0;

            if (currentCount >= LIMIT) {
                return NextResponse.json({
                    reply: "🔒 無料プランの上限（1日5回）に達しました。\nProプランにアップグレードすると無制限で利用できます！",
                    isLimitExceeded: true
                });
            }

            // 回数をカウントアップ
            if (usage) {
                await adminSupabase.from('ai_usage_logs').update({ count: currentCount + 1 }).eq('id', usage.id);
            } else {
                await adminSupabase.from('ai_usage_logs').insert({ user_id: userId, date: today, feature: 'chat', count: 1 });
            }
        }

        // --- 以下、AI処理 ---

        const { data: testResult } = await adminSupabase.from('test_results').select('score, level_result').eq('user_id', userId).order('taken_at', { ascending: false }).limit(1).single();
        const targetLanguage = profile?.learning_target || 'English';

        // Gemini 2.5 Flash (安定版)
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        const systemPrompt = `
      You are a friendly and encouraging AI study advisor named "Dojo Master".
      Your expertise is wide, covering all languages and subjects.
      
      User Profile:
      - Current Study Target: ${targetLanguage}
      - Level: ${testResult?.level_result || 'Unknown'}
      - Goal: ${profile?.goal || 'Not set'}
      
      User's Message: "${message}"
      
      Instructions:
      1. Your primary focus is on the user's "Current Study Target".
      2. If the user asks for recommendations ("おすすめは？"), YOU MUST generate a search keyword for the INTERNAL DATABASE.
         - Keyword should be in English or the target language.
         - Example: "Business", "Greeting", "Grammar"
      3. Respond in Japanese.
      
      Output Format (JSON):
      {
        "reply": "Your friendly advice.",
        "searchKeyword": "Keyword" (Optional)
      }
    `;

        const result = await model.generateContent(systemPrompt);
        const aiResponse = JSON.parse(result.response.text());

        let recommendedVideos: any[] = [];
        let recommendedDrills: any[] = [];

        // AIが検索キーワードを提案した場合、DB検索を実行
        if (aiResponse.searchKeyword) {
            try {
                // 1. 動画ライブラリから検索
                // (subjectカラムがない場合が多いので、タイトル検索を優先)
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
                    // ヒットしなければランダムに少し提案 (フォールバック)
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
                        aiResponse.reply += "\n(条件に合う動画が見つからなかったので、新着動画を表示します)";
                    }
                }

                // 2. ドリル（問題集）から検索
                // exercisesテーブルにsubjectカラムがある前提
                const { data: drills } = await adminSupabase
                    .from('exercises')
                    .select('id, title, category')
                    .eq('subject', targetLanguage) // 言語を絞り込み
                    .ilike('title', `%${aiResponse.searchKeyword}%`)
                    .limit(2);

                if (drills) {
                    recommendedDrills = drills;
                }

            } catch (dbError) {
                console.error('DB Search Error:', dbError);
            }
        }

        return NextResponse.json({
            reply: aiResponse.reply,
            videos: recommendedVideos,
            drills: recommendedDrills
        });

    } catch (error: any) {
        console.error('Chat Error:', error);

        // 429エラー等のハンドリング
        if (error.message?.includes('429')) {
            return NextResponse.json({
                reply: "ごめんなさい、少し休憩中です（AI利用制限）。しばらく時間を置いてからまた話しかけてください🍵",
                videos: []
            });
        }

        return NextResponse.json({ error: 'AI is sleeping...' }, { status: 500 });
    }
}


