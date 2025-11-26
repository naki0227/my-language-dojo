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

const SUBJECTS = ['English', 'Spanish', 'French', 'Chinese', 'Korean', 'Portuguese', 'Arabic', 'Russian', 'Programming', 'Sign Language'];
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
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-5xl mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="text-4xl">📖</span> {currentSubject} Library
                    </h1>
                    <div className="flex items-center gap-4">
                        <select value={currentSubject} onChange={(e) => handleSubjectChange(e.target.value)} className="bg-white border border-gray-300 px-4 py-2 rounded-lg font-bold">
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Link href="/" className="bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100">← Home</Link>
                    </div>
                </div>

                <div className="relative mb-6">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">🔍</span>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`検索...`} className="w-full pl-12 p-4 rounded-xl border border-gray-200 shadow-sm text-lg text-black" />
                </div>

                {/* ★レベル選択タブ */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {LEVELS.map(lvl => (
                        <button
                            key={lvl}
                            onClick={() => setCurrentLevel(lvl)}
                            className={`px-4 py-2 rounded-full font-bold text-sm transition whitespace-nowrap
                ${currentLevel === lvl ? 'bg-orange-500 text-white shadow-md scale-105' : 'bg-white text-gray-500 border hover:bg-gray-50'}
              `}
                        >
                            {lvl === 'ALL' ? 'すべて' : `Level ${lvl}`}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-gray-500">Loading...</div>
            ) : (
                <div className="w-full max-w-5xl grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredBooks.length > 0 ? (
                        filteredBooks.map((book) => {
                            let themeColor = 'bg-green-100 text-green-600';
                            let badge = book.level || 'DOC';

                            return (
                                <Link key={book.id} href={`/textbook/${book.id}`} className="group block bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-blue-300 transition-all duration-300 overflow-hidden transform hover:-translate-y-1">
                                    <div className={`h-32 ${themeColor} flex items-center justify-center relative overflow-hidden`}>
                                        <span className="text-6xl opacity-20 font-black">{badge}</span>
                                        <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded text-[10px] font-bold text-gray-500">Level {badge}</div>
                                    </div>
                                    <div className="p-5">
                                        <h2 className="text-lg font-bold text-gray-800 mb-3 line-clamp-2 group-hover:text-blue-600">{book.title}</h2>
                                        <p className="text-xs text-gray-400">📅 {new Date(book.created_at).toLocaleDateString()}</p>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center py-20 text-gray-500">見つかりませんでした</div>
                    )}
                </div>
            )}
        </main>
    );
}


