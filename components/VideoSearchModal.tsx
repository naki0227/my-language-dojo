'use client';

import { useState } from 'react';

type Video = {
    id: string;
    title: string;
    thumbnail: string;
    channel: string;
};

type Props = {
    onSelect: (videoId: string) => void;
    onClose: () => void;
};

export default function VideoSearchModal({ onSelect, onClose }: Props) {
    const [query, setQuery] = useState('');
    const [videos, setVideos] = useState<Video[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setVideos(data);
            }
        } catch (e) {
            alert('検索に失敗しました');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">YouTube動画検索</h3>
                    <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
                </div>

                <div className="p-4">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="キーワードを入力 (例: TED, English conversation)"
                            className="flex-1 border p-3 rounded-lg text-black"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="bg-red-600 text-white px-6 rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300"
                        >
                            {isSearching ? '...' : '検索'}
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
                    {videos.map((video) => (
                        <div
                            key={video.id}
                            onClick={() => { onSelect(video.id); onClose(); }}
                            className="flex gap-4 bg-white p-3 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition"
                        >
                            <img src={video.thumbnail} alt={video.title} className="w-32 h-20 object-cover rounded bg-gray-200" />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-2">{video.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">{video.channel}</p>
                            </div>
                        </div>
                    ))}
                    {videos.length === 0 && !isSearching && (
                        <p className="text-center text-gray-400 mt-10">動画を検索してください</p>
                    )}
                </div>
            </div>
        </div>
    );
}

