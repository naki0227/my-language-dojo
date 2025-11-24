import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 処理時間を長めに確保

export async function POST(request: Request) {
    try {
        const { level, keywords } = await request.json();

        // 1. 検索クエリの決定 (キーワードがなければランダムに揺らぎを与える)
        let query = keywords;
        if (!query) {
            const variations = [
                'lesson', 'practice', 'grammar', 'listening', 'conversation', 'story', 'vocabulary', 'tips'
            ];
            const randomVar = variations[Math.floor(Math.random() * variations.length)];

            const defaults: Record<string, string> = {
                'A1': `English beginner A1 ${randomVar}`,
                'A2': `English elementary A2 ${randomVar}`,
                'B1': `English intermediate B1 ${randomVar}`,
                'B2': `English upper intermediate B2 ${randomVar}`,
                'C1': `English advanced C1 ${randomVar}`,
                'C2': `English proficiency C2 ${randomVar}`
            };
            query = defaults[level] || `English learning ${level}`;
        }

        console.log(`[API] Deep Searching: "${query}" for Level ${level}`);

        // 2. 既に登録済みの動画IDを取得 (重複チェック用)
        const { data: existingItems } = await adminSupabase
            .from('roadmap_items')
            .select('video_id')
            .eq('level_code', level);

        const existingIds = new Set(existingItems?.map(item => item.video_id) || []);
        console.log(`[API] Found ${existingIds.size} existing videos.`);

        // 3. YouTube検索 & ページネーション (新しい動画が見つかるまで掘る)
        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        let search = await youtube.search(query);

        let newVideos: any[] = [];
        let attempt = 0;
        const MAX_ATTEMPTS = 5; // 最大5ページ分探す

        while (newVideos.length < 10 && attempt < MAX_ATTEMPTS) {
            // 取得した動画リストをチェック
            const videos = search.videos || [];

            for (const video of videos) {
                const v = video as any;
                if (v.id && !existingIds.has(v.id)) {
                    // 重複していない動画を発見！
                    newVideos.push({
                        video_id: v.id,
                        title: v.title?.text || v.title?.toString() || 'No Title',
                        description: `Recommended for Level ${level} (Topic: ${query})`,
                    });
                    // 登録済みリストに追加して、同じ動画を二重登録しないようにする
                    existingIds.add(v.id);
                }
                // 一回で追加するのは最大20件まで
                if (newVideos.length >= 20) break;
            }

            if (newVideos.length >= 20) break;

            // まだ足りなければ次のページへ
            console.log(`[API] Page ${attempt + 1}: Found ${newVideos.length} new videos so far. Fetching next page...`);
            try {
                if (search.has_continuation) {
                    search = await search.getContinuation();
                    attempt++;
                } else {
                    break; // 次のページがない
                }
            } catch (e) {
                break; // エラーなら終了
            }
        }

        if (newVideos.length === 0) {
            return NextResponse.json({
                success: false,
                count: 0,
                message: 'No new videos found. Try changing the keyword manually.'
            });
        }

        // 4. 現在のステップ数の最大値を取得
        const { data: maxData } = await adminSupabase
            .from('roadmap_items')
            .select('step_order')
            .eq('level_code', level)
            .order('step_order', { ascending: false })
            .limit(1)
            .single();

        let currentStep = maxData ? maxData.step_order : 0;

        // 5. DBに一括保存
        const rows = newVideos.map((v, i) => ({
            level_code: level,
            step_order: currentStep + i + 1,
            video_id: v.video_id,
            title: v.title,
            description: v.description
        }));

        const { error } = await adminSupabase.from('roadmap_items').insert(rows);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            count: rows.length,
            message: `Successfully added ${rows.length} new videos!`
        });

    } catch (error: any) {
        console.error('[API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


