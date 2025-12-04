'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SearchResult = {
    id: number;
    video_id: string;
    text: string;
    start_time: number;
    library_videos: {
        title: string;
        thumbnail_url: string;
    };
};

export default function SearchPage() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // 初回ロード時にログインチェック
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/auth');
                return;
            }
            setUserId(session.user.id);
        };
        checkSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || !userId) return;

        setIsSearching(true);

        // 自分のライブラリ(user_id)の中から検索
        const { data, error } = await supabase
            .from('library_subtitles')
            .select(`
        *,
        library_videos ( title, thumbnail_url )
      `)
            .eq('user_id', userId) // ★ここが重要！
            .ilike('text', `%${query}%`)
            .limit(20);

        if (error) {
            console.error(error);
            alert('検索エラー');
        } else {
            setResults(data as any || []);
        }
        setIsSearching(false);
    };

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-5xl relative z-10">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2 tracking-tight">
                        <span className="text-4xl">🔍</span> Vidnitive Phrase Search
                    </h1>
                    <Link href="/" className="glass px-6 py-2 rounded-xl font-bold text-indigo-600 hover:bg-white/50 transition">
                        ← Studio
                    </Link>
                </div>

                <div className="glass-card p-8 mb-8">
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your library (e.g., dream)"
                            className="flex-1 p-4 rounded-xl bg-white/50 border border-white/20 text-lg shadow-inner text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 outline-none transition"
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    {results.map((item) => (
                        <Link
                            key={item.id}
                            href={`/?videoId=${item.video_id}&start=${Math.floor(item.start_time)}`}
                            className="block glass-card p-4 hover:shadow-xl hover:scale-[1.01] transition-all group border-0"
                        >
                            <div className="flex gap-6 items-center">
                                <div className="relative shrink-0">
                                    <img
                                        src={item.library_videos?.thumbnail_url}
                                        alt="thumb"
                                        className="w-40 h-24 object-cover rounded-lg shadow-md group-hover:shadow-lg transition"
                                    />
                                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                                        {Math.floor(item.start_time)}s
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition leading-relaxed">
                                        "... <span className="bg-yellow-100/50 px-1 rounded">{item.text}</span> ..."
                                    </p>
                                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-2 font-medium">
                                        📺 {item.library_videos?.title || item.video_id}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {results.length === 0 && !isSearching && query && (
                        <div className="text-center py-20 glass-card">
                            <p className="text-xl font-bold text-gray-400 mb-2">No matches found</p>
                            <p className="text-gray-400">Try a different keyword or add more videos to your library.</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
