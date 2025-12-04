'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Video = {
    video_id: string;
    title: string;
    source: string; // 'Roadmap' or 'Library' or 'Direct'
};

type Props = {
    onSelect: (videoId: string) => void;
    onClose: () => void;
    currentSubject?: string; // 言語フィルタ用
};

import { getApiUrl } from '@/lib/api';

export default function VideoSearchModal({ onSelect, onClose, currentSubject = 'English' }: Props) {
    const [query, setQuery] = useState('');
    const [videos, setVideos] = useState<Video[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // 初期表示: おすすめ動画（ロードマップなどから）を表示
    useEffect(() => {
        handleSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSearching(true);

        // 1. ロードマップから検索 (タイトル または ID)
        let roadmapQuery = supabase
            .from('roadmap_items')
            .select('video_id, title')
            .eq('subject', currentSubject)
            .limit(10);

        if (query) {
            // タイトルが部分一致 OR IDが完全一致
            roadmapQuery = roadmapQuery.or(`title.ilike.%${query}%,video_id.eq.${query}`);
        }

        // 2. ライブラリ動画から検索 (タイトル または ID)
        let libraryQuery = supabase
            .from('library_videos')
            .select('video_id, title')
            .limit(10);

        if (query) {
            libraryQuery = libraryQuery.or(`title.ilike.%${query}%,video_id.eq.${query}`);
        }

        // 3. YouTube検索 (クエリがある場合のみ)
        let youtubePromise: Promise<any[]> = Promise.resolve([]);
        if (query && query.length > 2) {
            youtubePromise = fetch(getApiUrl(`/api/youtube/search?q=${encodeURIComponent(query)}`))
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        return data.map((v: any) => ({
                            video_id: v.id,
                            title: v.title,
                            source: 'YouTube'
                        }));
                    }
                    return [];
                })
                .catch(err => {
                    console.error("YouTube Search Error", err);
                    return [];
                });
        }

        const [roadmapRes, libraryRes, youtubeRes] = await Promise.all([roadmapQuery, libraryQuery, youtubePromise]);

        const results: Video[] = [];

        // 結合して重複排除
        const addedIds = new Set();

        roadmapRes.data?.forEach((item: any) => {
            if (item.video_id && !addedIds.has(item.video_id)) {
                results.push({ video_id: item.video_id, title: item.title, source: 'Roadmap' });
                addedIds.add(item.video_id);
            }
        });

        libraryRes.data?.forEach((item: any) => {
            if (item.video_id && !addedIds.has(item.video_id)) {
                results.push({ video_id: item.video_id, title: item.title, source: 'Library' });
                addedIds.add(item.video_id);
            }
        });

        // YouTube結果を追加
        (youtubeRes as any[]).forEach((item: any) => {
            if (item.video_id && !addedIds.has(item.video_id)) {
                results.push(item);
                addedIds.add(item.video_id);
            }
        });

        // ★改良: 検索結果が0件でも、入力が「動画IDっぽい(11文字)」なら、直接選択肢として出す
        if (results.length === 0 && query.length === 11) {
            results.push({
                video_id: query,
                title: `ID: ${query} (未登録動画)`,
                source: 'Direct Input'
            });
        }

        setVideos(results);
        setIsSearching(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">📚 動画を選択</h3>
                    <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
                </div>

                <div className="p-4 bg-blue-50">
                    <p className="text-xs text-blue-600 mb-2">※ 「動画タイトル」または「YouTube ID」で検索できます。</p>
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="キーワード または 動画ID..."
                            className="flex-1 border p-3 rounded-lg text-black"
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300"
                        >
                            {isSearching ? '...' : '検索'}
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-100">
                    {videos.map((video) => (
                        <div
                            key={video.video_id}
                            onClick={() => { onSelect(video.video_id); onClose(); }}
                            className="flex gap-4 bg-white p-3 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition items-center"
                        >
                            <span className={`text-xs px-2 py-1 rounded font-bold ${video.source === 'Roadmap' ? 'bg-purple-100 text-purple-600' : video.source === 'Library' ? 'bg-green-100 text-green-600' : video.source === 'YouTube' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>
                                {video.source}
                            </span>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 text-sm truncate">{video.title}</h4>
                                <p className="text-xs text-gray-500">ID: {video.video_id}</p>
                            </div>
                            <span className="text-blue-500 text-sm font-bold">選択</span>
                        </div>
                    ))}
                    {videos.length === 0 && !isSearching && (
                        <div className="text-center text-gray-400 mt-10">
                            <p>動画が見つかりません。</p>
                            <p className="text-xs mt-2">※ IDを直接入力して検索すると、未登録の動画も選択できます。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


