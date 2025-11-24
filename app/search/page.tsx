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
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Phrase Search 🔍</h1>
                <Link href="/" className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                    ← Player
                </Link>
            </div>

            <form onSubmit={handleSearch} className="w-full max-w-2xl flex gap-2 mb-10">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="自分のライブラリから検索 (例: dream)"
                    className="flex-1 p-4 rounded-lg border border-gray-300 text-lg shadow-sm text-black"
                />
                <button
                    type="submit"
                    disabled={isSearching}
                    className="bg-blue-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-700 transition shadow-md disabled:bg-gray-400"
                >
                    {isSearching ? '...' : '検索'}
                </button>
            </form>

            <div className="w-full max-w-4xl space-y-4">
                {results.map((item) => (
                    <Link
                        key={item.id}
                        href={`/?videoId=${item.video_id}&start=${Math.floor(item.start_time)}`}
                        className="block bg-white p-4 rounded-xl shadow hover:shadow-md hover:border-blue-400 border border-transparent transition group"
                    >
                        <div className="flex gap-4 items-center">
                            <img
                                src={item.library_videos?.thumbnail_url}
                                alt="thumb"
                                className="w-32 h-20 object-cover rounded bg-gray-200"
                            />
                            <div>
                                <p className="text-lg font-bold text-gray-800 group-hover:text-blue-600">
                                    "... {item.text} ..."
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    📺 {item.library_videos?.title || item.video_id} | ⏱ {Math.floor(item.start_time)}秒付近
                                </p>
                            </div>
                        </div>
                    </Link>
                ))}

                {results.length === 0 && !isSearching && query && (
                    <p className="text-gray-500 text-center">見つかりませんでした。動画をライブラリに追加していますか？</p>
                )}
            </div>
        </main>
    );
}
