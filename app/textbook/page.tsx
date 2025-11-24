'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react'; // useCallbackを使用

type Textbook = {
    id: number;
    title: string;
    created_at: string;
    subject: string; // 対象言語
};

export default function TextbookList() {
    const router = useRouter();
    const [allBooks, setAllBooks] = useState<Textbook[]>([]);
    const [filteredBooks, setFilteredBooks] = useState<Textbook[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [targetSubject, setTargetSubject] = useState('English');

    // データ取得ロジック
    const fetchBooks = useCallback(async (currentSubject: string) => {
        setIsLoading(true);
        // ユーザーの学習対象言語でフィルタリングしてデータを取得
        const { data } = await supabase
            .from('textbooks')
            .select('*')
            .eq('subject', currentSubject) // ★対象言語でフィルタ
            .order('title', { ascending: true });

        if (data) {
            const sortedData = data.sort((a, b) => new Intl.Collator('ja', { numeric: true }).compare(a.title, b.title));
            setAllBooks(sortedData);
            setFilteredBooks(sortedData);
        } else {
            setAllBooks([]);
            setFilteredBooks([]);
        }
        setIsLoading(false);
    }, []);

    // 初期ロードとユーザー情報取得
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }

            // ユーザーの学習対象言語を取得
            const { data: profile } = await supabase.from('profiles').select('learning_target').eq('id', session.user.id).single();
            const currentSubject = profile?.learning_target || 'English';
            setTargetSubject(currentSubject);

            await fetchBooks(currentSubject); // データを取得
        };
        init();
    }, [router, fetchBooks]);

    // フィルタリングロジック
    useEffect(() => {
        let result = allBooks;

        if (searchQuery) {
            result = result.filter(book =>
                book.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (activeCategory !== 'all') {
            result = result.filter(book => {
                if (activeCategory === 'jhs') return book.title.includes('中学');
                if (activeCategory === 'hs') return book.title.includes('高校');
                if (activeCategory === 'eiken') return book.title.includes('英検');
                if (activeCategory === 'business') return book.title.includes('ビジネス');

                if (activeCategory === 'grammar') {
                    return !book.title.includes('中学') &&
                        !book.title.includes('高校') &&
                        !book.title.includes('英検') &&
                        !book.title.includes('ビジネス');
                }
                return true;
            });
        }

        setFilteredBooks(result);
    }, [searchQuery, activeCategory, allBooks]);

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-5xl mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="text-4xl">📖</span> {targetSubject} Library
                    </h1>
                    <Link href="/" className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition shadow-sm">
                        ← Home
                    </Link>
                </div>

                <div className="relative mb-6">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`${targetSubject} の教科書を検索...`}
                        className="w-full pl-12 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-lg text-black transition"
                    />
                </div>

                {/* カテゴリタブ */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                        { id: 'all', label: 'すべて', icon: '📚', color: 'bg-gray-600' },
                        { id: 'jhs', label: '中学英語', icon: '🏆', color: 'bg-yellow-500' },
                        { id: 'hs', label: '高校英語', icon: '🎓', color: 'bg-indigo-500' },
                        { id: 'eiken', label: '英検対策', icon: '💮', color: 'bg-red-500' },
                        { id: 'business', label: 'ビジネス', icon: '💼', color: 'bg-blue-500' },
                        { id: 'grammar', label: '文法・教養', icon: '📝', color: 'bg-green-500' },
                    ].map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-5 py-2.5 rounded-full font-bold whitespace-nowrap transition flex items-center gap-2 shadow-sm
                ${activeCategory === cat.id
                                    ? `${cat.color} text-white shadow-md transform scale-105`
                                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}
              `}
                        >
                            <span>{cat.icon}</span> {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20">
                    <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading {targetSubject} library...</p>
                </div>
            ) : (
                <div className="w-full max-w-5xl grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredBooks.length > 0 ? (
                        filteredBooks.map((book) => {
                            let themeColor = 'bg-green-100 text-green-600';
                            let badge = 'Grammar';

                            if (book.title.includes('中学')) { themeColor = 'bg-yellow-100 text-yellow-600'; badge = 'JHS'; }
                            else if (book.title.includes('高校')) { themeColor = 'bg-indigo-100 text-indigo-600'; badge = 'High School'; }
                            else if (book.title.includes('英検')) { themeColor = 'bg-red-100 text-red-600'; badge = 'EIKEN'; }
                            else if (book.title.includes('ビジネス')) { themeColor = 'bg-blue-100 text-blue-600'; badge = 'Business'; }

                            return (
                                <Link
                                    key={book.id}
                                    href={`/textbook/${book.id}`}
                                    className="group block bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-blue-300 transition-all duration-300 overflow-hidden transform hover:-translate-y-1"
                                >
                                    <div className={`h-32 ${themeColor} flex items-center justify-center relative overflow-hidden`}>
                                        <span className="text-6xl opacity-20 transform group-hover:scale-110 transition-transform duration-500 font-black">
                                            {badge}
                                        </span>
                                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            {badge} Series
                                        </div>
                                    </div>

                                    <div className="p-5">
                                        <h2 className="text-lg font-bold text-gray-800 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors min-h-[3.5rem]">
                                            {book.title}
                                        </h2>
                                        <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                <span>📅</span> {new Date(book.created_at).toLocaleDateString()}
                                            </p>
                                            <span className="text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Read Now →
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
                            <p className="text-xl mb-2">😭 {targetSubject} のコンテンツが見つかりません</p>
                            <p className="text-sm">管理画面で新しい教科書を生成してください。</p>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}

