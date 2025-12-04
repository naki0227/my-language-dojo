'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Textbook = {
    id: number;
    title: string;
    created_at: string;
    subject: string;
    level: string; // ★追加
};

const SUBJECTS = ['English', 'Spanish', 'French', 'Chinese', 'Korean', 'Portuguese', 'Arabic', 'Russian', 'German', 'Italian', 'Indonesian', 'Programming', 'Sign Language'];
const LEVELS = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function TextbookList() {
    const router = useRouter();
    const [allBooks, setAllBooks] = useState<Textbook[]>([]);
    const [filteredBooks, setFilteredBooks] = useState<Textbook[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [currentSubject, setCurrentSubject] = useState('English');
    const [currentLevel, setCurrentLevel] = useState('ALL'); // ★レベルフィルタ

    const fetchBooks = useCallback(async (subject: string) => {
        setIsLoading(true);
        const { data } = await supabase
            .from('textbooks')
            .select('*')
            .eq('subject', subject)
            .order('title', { ascending: true });

        if (data) {
            // 日本語タイトルが多いので自然順ソート
            const sortedData = data.sort((a, b) => new Intl.Collator('ja', { numeric: true }).compare(a.title, b.title));
            setAllBooks(sortedData);
            // 初期ロード時はレベルフィルタも適用する（useEffect側で行うため、ここでは全データセット）
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }

            const { data: profile } = await supabase.from('profiles').select('learning_target').eq('id', session.user.id).single();
            const initialSubject = profile?.learning_target || 'English';
            setCurrentSubject(initialSubject);

            // ★ユーザーレベル取得
            const { data: userLevel } = await supabase
                .from('user_levels')
                .select('level_result')
                .match({ user_id: session.user.id, subject: initialSubject })
                .single();

            let initialLevel = 'ALL';
            if (userLevel && userLevel.level_result) {
                const code = userLevel.level_result.split(' ')[0];
                if (LEVELS.includes(code)) initialLevel = code;
            }
            setCurrentLevel(initialLevel);

            await fetchBooks(initialSubject);
        };
        init();
    }, [router, fetchBooks]);

    // フィルタリングロジック (検索 + レベル)
    useEffect(() => {
        let result = allBooks;

        // 1. 検索
        if (searchQuery) {
            result = result.filter(book => book.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // 2. レベルフィルタ
        if (currentLevel !== 'ALL') {
            result = result.filter(book => {
                // levelカラムがあればそれを見る、なければタイトルから推測
                const lvl = book.level || '';
                return lvl.includes(currentLevel) || book.title.includes(currentLevel);
            });
        }

        setFilteredBooks(result);
    }, [searchQuery, currentLevel, allBooks]);

    const handleSubjectChange = (newSubject: string) => {
        setCurrentSubject(newSubject);
        fetchBooks(newSubject);
    };

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-6xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3 tracking-tight">
                        <span className="text-4xl">📖</span> Vidnitive Library
                    </h1>
                    <div className="flex items-center gap-4">
                        <select value={currentSubject} onChange={(e) => handleSubjectChange(e.target.value)} className="glass px-4 py-2 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400">
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Link href="/" className="glass px-6 py-2 rounded-xl font-bold text-indigo-600 hover:bg-white/50 transition">← Studio</Link>
                    </div>
                </div>

                <div className="glass-card p-6 mb-8">
                    <div className="relative mb-6">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">🔍</span>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Search ${currentSubject} textbooks...`} className="w-full pl-12 p-4 rounded-xl bg-white/50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-none transition text-lg text-gray-800 placeholder-gray-400" />
                    </div>

                    {/* ★レベル選択タブ */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {LEVELS.map(lvl => (
                            <button
                                key={lvl}
                                onClick={() => setCurrentLevel(lvl)}
                                className={`px-5 py-2.5 rounded-full font-bold text-sm transition whitespace-nowrap shadow-sm
                    ${currentLevel === lvl ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-105' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'}
                  `}
                            >
                                {lvl === 'ALL' ? 'All Levels' : `Level ${lvl}`}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-500 font-medium">Loading Library...</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredBooks.length > 0 ? (
                            filteredBooks.map((book) => {
                                let badge = book.level || 'DOC';
                                return (
                                    <Link key={book.id} href={`/textbook/view?id=${book.id}`} className="group block glass-card overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0">
                                        <div className={`h-40 bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center relative overflow-hidden group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors`}>
                                            <span className="text-8xl opacity-10 font-black text-indigo-900 transform group-hover:scale-110 transition duration-700">{badge}</span>
                                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm">Level {badge}</div>
                                        </div>
                                        <div className="p-6">
                                            <h2 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-indigo-600 transition">{book.title}</h2>
                                            <div className="flex justify-between items-center mt-4">
                                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">TEXTBOOK</span>
                                                <span className="text-xs text-gray-400">📅 {new Date(book.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })
                        ) : (
                            <div className="col-span-full text-center py-20 glass-card">
                                <p className="text-xl font-bold text-gray-400 mb-2">No textbooks found</p>
                                <p className="text-gray-400">Try adjusting your search or filters.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}


