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
        const { level, keywords, targetSubject } = await request.json();
        const query = keywords || `${targetSubject || 'English'} learning ${level}`;

        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        const search = await youtube.search(query);

        // ★修正: 検索結果を安全に取り出す
        const videos = search.videos || [];
        const validVideos = videos
            .map((v: any) => ({
                video_id: v.id,
                // タイトルが文字列だったりオブジェクトだったりするので両対応
                title: v.title?.text || v.title?.toString() || 'No Title',
                description: `Level ${level} Video`
            }))
            .filter((v: any) => v.video_id); // IDがないものは除外

        if (validVideos.length === 0) {
            return NextResponse.json({ success: false, message: 'No videos found' });
        }

        // DB保存処理 (上位10件)
        const itemsToAdd = validVideos.slice(0, 10).map((v: any, i: number) => ({
            level_code: level,
            step_order: i + 1, // 簡易的に連番
            video_id: v.video_id,
            title: v.title,
            description: v.description,
            subject: targetSubject || 'English'
        }));

        await adminSupabase.from('roadmap_items').insert(itemsToAdd);

        return NextResponse.json({ success: true, count: itemsToAdd.length });

    } catch (error: any) {
        console.error('Roadmap API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}