'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const SUBJECTS = ['English', 'Spanish', 'French', 'Chinese', 'Korean', 'Portuguese', 'Arabic', 'Russian', 'German', 'Italian', 'Indonesian', 'Programming', 'Sign Language'];
const LEVELS = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function DrillIndex() {
    const router = useRouter();
    const [wordbooks, setWordbooks] = useState<any[]>([]);
    const [exercises, setExercises] = useState<any[]>([]);
    const [currentSubject, setCurrentSubject] = useState('English');
    const [currentLevel, setCurrentLevel] = useState('ALL'); // ★レベルフィルタ
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async (subject: string, level: string) => {
        setIsLoading(true);

        let wbQuery = supabase.from('wordbooks').select('*').eq('subject', subject);
        let exQuery = supabase.from('exercises').select('*').eq('subject', subject);

        // レベルフィルタ (ALL以外なら絞り込み)
        // ※ データ側のレベル表記が "A1" だったり "Pre-2" だったり揺れがある場合は ilike で部分一致させるのが安全
        if (level !== 'ALL') {
            wbQuery = wbQuery.ilike('level', `%${level}%`);
            exQuery = exQuery.ilike('level', `%${level}%`);
        }

        const { data: wb } = await wbQuery;
        const { data: ex } = await exQuery;

        if (wb) setWordbooks(wb); else setWordbooks([]);
        if (ex) setExercises(ex); else setExercises([]);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }

            // プロフィール取得
            const { data: profile } = await supabase.from('profiles').select('learning_target').eq('id', session.user.id).single();
            const initialSubject = profile?.learning_target || 'English';
            setCurrentSubject(initialSubject);

            // ★ユーザーレベル取得
            const { data: userLevel } = await supabase
                .from('user_levels')
                .select('level_result')
                .match({ user_id: session.user.id, subject: initialSubject })
                .single();

            // "A1 (Beginner)" -> "A1" を抽出して初期選択にする
            let initialLevel = 'ALL';
            if (userLevel && userLevel.level_result) {
                const code = userLevel.level_result.split(' ')[0]; // "A1"
                if (LEVELS.includes(code)) initialLevel = code;
            }
            setCurrentLevel(initialLevel);

            fetchData(initialSubject, initialLevel);
        };
        init();
    }, [router, fetchData]);

    const handleSubjectChange = (newSubject: string) => {
        setCurrentSubject(newSubject);
        fetchData(newSubject, currentLevel);
    };

    const handleLevelChange = (newLevel: string) => {
        setCurrentLevel(newLevel);
        fetchData(currentSubject, newLevel);
    };

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-6xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3 tracking-tight">
                        <span className="text-4xl">🔥</span> {currentSubject} Vidnitive Drill
                    </h1>

                    <div className="flex items-center gap-4">
                        <select
                            value={currentSubject}
                            onChange={(e) => handleSubjectChange(e.target.value)}
                            className="glass px-4 py-2 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Link href="/" className="glass px-6 py-2 rounded-xl font-bold text-indigo-600 hover:bg-white/50 transition">← Studio</Link>
                    </div>
                </div>

                {/* ★レベル選択タブ */}
                <div className="glass-card p-4 mb-8 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {LEVELS.map(lvl => (
                            <button
                                key={lvl}
                                onClick={() => handleLevelChange(lvl)}
                                className={`px-5 py-2.5 rounded-full font-bold text-sm transition whitespace-nowrap shadow-sm
                    ${currentLevel === lvl
                                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md scale-105'
                                        : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'}
                  `}
                            >
                                {lvl === 'ALL' ? 'All Levels' : `Level ${lvl}`}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
                        <p className="text-gray-500 font-medium">Loading Drills...</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* 単語帳 */}
                        <div className="glass-card p-6 border-t-4 border-blue-500">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                                <span className="text-blue-500">📚</span> Vocabulary
                                <span className="text-sm font-normal text-gray-500 ml-auto bg-white/50 px-3 py-1 rounded-full">{wordbooks.length} Books</span>
                            </h2>
                            {wordbooks.length === 0 && <div className="text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl">No vocabulary books found for this level.</div>}
                            <div className="space-y-4">
                                {wordbooks.map((book) => (
                                    <Link key={book.id} href={`/drill/word/${book.id}`} className="block p-5 rounded-xl bg-white/60 hover:bg-white hover:shadow-lg transition border border-transparent hover:border-blue-200 group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition">{book.title}</div>
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">{book.level}</span>
                                        </div>
                                        <div className="text-sm text-gray-500 line-clamp-2">{book.description}</div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* 問題集 */}
                        <div className="glass-card p-6 border-t-4 border-red-500">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                                <span className="text-red-500">✍️</span> Exercises
                                <span className="text-sm font-normal text-gray-500 ml-auto bg-white/50 px-3 py-1 rounded-full">{exercises.length} Sets</span>
                            </h2>
                            {exercises.length === 0 && <div className="text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl">No exercises found for this level.</div>}
                            <div className="space-y-4">
                                {exercises.map((ex) => (
                                    <Link key={ex.id} href={`/drill/exam/${ex.id}`} className="block p-5 rounded-xl bg-white/60 hover:bg-white hover:shadow-lg transition border border-transparent hover:border-red-200 group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-lg text-gray-800 group-hover:text-red-600 transition">{ex.title}</div>
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">{ex.level}</span>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                            Category: {ex.category}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}


