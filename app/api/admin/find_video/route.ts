import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

export const dynamic = 'force-dynamic';

import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(request: Request) {
    try {
        await verifyAdmin(request);
        const { mode, value, subject } = await request.json(); // mode: 'id' | 'keyword' | 'auto'
        const targetSubject = subject || 'English';

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // 高速なFlashモデル

        // Innertubeの初期化 (US設定で回避率アップ)
        const youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
            lang: 'en',
            location: 'US'
        });

        let searchSocket = '';

        // --- 1. ID指定の場合 (1件だけ返す) ---
        if (mode === 'id') {
            try {
                const info = await youtube.getBasicInfo(value);
                return NextResponse.json({
                    videos: [{
                        videoId: info.basic_info.id,
                        title: info.basic_info.title,
                        thumbnail: info.basic_info.thumbnail?.[0]?.url || '',
                    }],
                    message: "ID指定で動画が見つかりました"
                });
            } catch (e) {
                return NextResponse.json({ error: 'Invalid Video ID or Video Unavailable' }, { status: 404 });
            }
        }

        // --- 2. キーワード/AIの場合 (検索して複数返す) ---
        if (mode === 'keyword') {
            searchSocket = `${targetSubject} ${value}`;
            // 英語なら学習系に絞るためのワード追加
            if (targetSubject === 'English') searchSocket += ' lesson subtitle';
        }
        else if (mode === 'auto') {
            const prompt = `
        Suggest ONE interesting and educational video topic for learning ${targetSubject}.
        It should be specific (e.g. "Daily routine vlog", "How to order coffee").
        Output ONLY the search keyword in English.
      `;
            const result = await model.generateContent(prompt);
            const topic = result.response.text().trim();
            searchSocket = `${targetSubject} ${topic}`;
        }

        console.log(`[API] Searching: ${searchSocket}`);
        const search = await youtube.search(searchSocket);

        // 上位からShortsを除外して最大10件取得
        const videos = search.videos
            .filter((v: any) => v.id && !v.is_shorts) // IDがあり、Shortsでないもの
            .slice(0, 10) // 10件
            .map((v: any) => ({
                videoId: v.id,
                // タイトルやサムネを安全に取得
                title: v.title?.text || v.title?.toString() || 'No Title',
                thumbnail: v.thumbnails?.[0]?.url || '',
            }));

        if (videos.length === 0) {
            return NextResponse.json({ error: 'No suitable videos found' }, { status: 404 });
        }

        return NextResponse.json({
            videos: videos,
            message: mode === 'auto' ? `AIが「${searchSocket}」で10件選定しました` : `「${searchSocket}」の検索結果 (${videos.length}件)`
        });

    } catch (error: any) {
        console.error('[API] Find Video Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}