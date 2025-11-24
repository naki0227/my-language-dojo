import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
        const { level, keywords, targetSubject } = await request.json(); // ★修正: targetSubjectを受け取る

        if (!targetSubject) {
            return NextResponse.json({ error: 'Target Subject is required' }, { status: 400 });
        }

        // 検索クエリの決定
        let query = keywords;
        if (!query) {
            const randomVar = ['lesson', 'practice', 'grammar', 'listening', 'conversation', 'story', 'vocabulary', 'tips'][Math.floor(Math.random() * 8)];
            query = `${targetSubject} learning ${level} ${randomVar}`; // 検索クエリに対象言語を入れる
        }

        console.log(`[API] Searching: "${query}" for Level ${level} in ${targetSubject}`);

        // 1. 既存の動画IDを取得 (重複チェック用)
        const { data: existingItems } = await adminSupabase
            .from('roadmap_items')
            .select('video_id')
            .eq('level_code', level)
            .eq('subject', targetSubject); // ★対象言語でフィルタリング

        const existingIds = new Set(existingItems?.map(item => item.video_id) || []);

        // 2. YouTube検索 & ページネーション
        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        let search = await youtube.search(query);

        let newVideos: any[] = [];
        let attempt = 0;
        const MAX_ATTEMPTS = 5;

        while (newVideos.length < 20 && attempt < MAX_ATTEMPTS) { // 最大20件まで追加
            const videos = search.videos || [];

            for (const video of videos) {
                const v = video as any;
                if (v.id && !existingIds.has(v.id)) {
                    newVideos.push({
                        video_id: v.id,
                        title: v.title?.text || v.title?.toString() || 'No Title',
                        description: `Recommended for Level ${level} (${targetSubject})`,
                    });
                    existingIds.add(v.id);
                }
                if (newVideos.length >= 20) break;
            }

            if (newVideos.length >= 20) break;

            // 次のページへ
            try {
                if (search.has_continuation) {
                    search = await search.getContinuation();
                    attempt++;
                } else {
                    break;
                }
            } catch (e) { break; }
        }

        if (newVideos.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                message: 'No new videos found.'
            });
        }

        // 3. ステップ数の最大値を取得
        const { data: maxData } = await adminSupabase
            .from('roadmap_items')
            .select('step_order')
            .eq('level_code', level)
            .eq('subject', targetSubject) // ★対象言語でフィルタリング
            .order('step_order', { ascending: false })
            .limit(1)
            .single();

        let currentStep = maxData ? maxData.step_order : 0;

        // 4. DBに保存
        const rows = newVideos.map((v: any, i: number) => ({
            level_code: level,
            step_order: currentStep + i + 1,
            video_id: v.video_id,
            title: v.title,
            description: v.description,
            subject: targetSubject // ★言語を保存
        }));

        const { error } = await adminSupabase.from('roadmap_items').insert(rows);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            count: rows.length,
            message: `Successfully added ${rows.length} new videos to ${targetSubject} Level ${level}!`
        });

    } catch (error: any) {
        console.error('[API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

