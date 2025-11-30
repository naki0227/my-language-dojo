import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { YoutubeTranscript } from 'youtube-transcript';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

async function fetchRaw(videoId: string): Promise<any> {
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        return { source: 'youtube-transcript', data: transcript.map((t: any) => ({ text: t.text, offset: Math.floor(t.offset), duration: Math.floor(t.duration) })) };
    } catch (errA) {
        // Innertubeは壊れているため、今回はスキップ (将来的にはここも修正が必要)
        throw new Error("youtube-transcript failed");
    }
}

import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(request: Request) {
    try {
        await verifyAdmin(request);
        const { videoId } = await request.json();

        if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 });

        const result = await fetchRaw(videoId);

        // 取得成功時、一時的なテーブルに保存（または処理を継続）
        if (result.data.length > 0) {
            // raw_transcripts テーブルに保存するべきだが、今回はセッション内で表示するだけにする
            return NextResponse.json({ success: true, rawLines: result.data });
        }

        return NextResponse.json({ success: false, error: "No subtitles found or service blocked." }, { status: 404 });

    } catch (error: any) {
        console.error('[API] Raw Fetch Error:', error);
        return NextResponse.json({ error: error.message || 'Fatal error during fetch.' }, { status: 500 });
    }
}