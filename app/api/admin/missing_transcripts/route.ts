import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. 登録済みの全動画IDを取得 (ロードマップとライブラリ)
        const { data: roadmapVideos } = await adminSupabase.from('roadmap_items').select('video_id, title, subject');
        const { data: libraryVideos } = await adminSupabase.from('library_videos').select('video_id, title');

        // 2. 既に字幕データを持っている動画IDを取得
        const { data: existingTranscripts } = await adminSupabase.from('optimized_transcripts').select('video_id');
        const existingIds = new Set(existingTranscripts?.map(t => t.video_id));

        // 3. マージして未取得のものを抽出
        const allVideos = new Map(); // IDで重複排除

        roadmapVideos?.forEach(v => {
            if (!existingIds.has(v.video_id)) {
                allVideos.set(v.video_id, { id: v.video_id, title: v.title, source: `Roadmap (${v.subject})` });
            }
        });

        libraryVideos?.forEach(v => {
            if (!existingIds.has(v.video_id) && !allVideos.has(v.video_id)) {
                allVideos.set(v.video_id, { id: v.video_id, title: v.title, source: 'Library' });
            }
        });

        const missingList = Array.from(allVideos.values());

        return NextResponse.json({ count: missingList.length, videos: missingList });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

