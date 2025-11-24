import { NextResponse } from 'next/server';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        const youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
        });

        const search = await youtube.search(query);

        // --- 修正箇所: 安全にデータを取り出す ---
        // search.videos が空の場合もあるのでガード
        const rawVideos = search.videos || [];

        const videos = rawVideos.map((v: any) => {
            // タイトルを安全に取得 (toString() は youtubei.js の Text オブジェクトで有効)
            const title = v.title?.toString() || v.title?.text || 'Untitled Video';

            // サムネイルを安全に取得
            const thumbnail = v.thumbnails?.[0]?.url || '';

            // チャンネル名を安全に取得
            const channel = v.author?.name || v.author?.toString() || 'Unknown Channel';

            return {
                id: v.id,
                title: title,
                thumbnail: thumbnail,
                channel: channel
            };
        });

        return NextResponse.json(videos);

    } catch (error) {
        console.error('Search Error:', error);
        return NextResponse.json({ error: 'Failed to search videos' }, { status: 500 });
    }
}


