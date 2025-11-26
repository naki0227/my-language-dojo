'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Video = {
    video_id: string;
    title: string;
    source: string; // 'Roadmap' or 'Library'
};

type Props = {
    onSelect: (videoId: string) => void;
    onClose: () => void;
    currentSubject?: string; // 言語フィルタ用
};

export default function InternalVideoSearchModal({ onSelect, onClose, currentSubject = 'English' }: Props) {
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

        // 1. ロードマップから検索
        let roadmapQuery = supabase
            .from('roadmap_items')
            .select('video_id, title')
            .eq('subject', currentSubject)
            .limit(20);

        if (query) {
            roadmapQuery = roadmapQuery.ilike('title', `%${query}%`);
        }

        // 2. ライブラリ動画から検索
        let libraryQuery = supabase
            .from('library_videos')
            .select('video_id, title')
            .limit(20);

        if (query) {
            libraryQuery = libraryQuery.ilike('title', `%${query}%`);
        }

        const [roadmapRes, libraryRes] = await Promise.all([roadmapQuery, libraryQuery]);

        const results: Video[] = [];

        // 結合して重複排除
        const addedIds = new Set();

        roadmapRes.data?.forEach((item: any) => {
            if (!addedIds.has(item.video_id)) {
                results.push({ video_id: item.video_id, title: item.title, source: 'Roadmap' });
                addedIds.add(item.video_id);
            }
        });

        libraryRes.data?.forEach((item: any) => {
            if (!addedIds.has(item.video_id)) {
                results.push({ video_id: item.video_id, title: item.title, source: 'Library' });
                addedIds.add(item.video_id);
            }
        });

        setVideos(results);
        setIsSearching(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">📚 ライブラリから動画を選択</h3>
                    <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
                </div>

                <div className="p-4 bg-blue-50">
                    <p className="text-xs text-blue-600 mb-2">※ 通信量を節約するため、YouTube検索ではなくアプリ内の動画から探します。</p>
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="タイトルで検索..."
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
                            <span className={`text-xs px-2 py-1 rounded font-bold ${video.source === 'Roadmap' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
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
                        <p className="text-center text-gray-400 mt-10">動画が見つかりません。<br />ロードマップを生成するか、URLから直接IDを入力してください。</p>
                    )}
                </div>
            </div>
        </div>
    );
}