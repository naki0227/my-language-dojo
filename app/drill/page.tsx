'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const SUBJECTS = ['English', 'Spanish', 'French', 'Chinese', 'Korean', 'Portuguese', 'Arabic', 'Russian', 'Programming', 'Sign Language'];
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
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-5xl mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    🔥 {currentSubject} Drill
                </h1>

                <div className="flex items-center gap-4">
                    <select
                        value={currentSubject}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm font-bold"
                    >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Link href="/" className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 text-gray-700">← Home</Link>
                </div>
            </div>

            {/* ★レベル選択タブ */}
            <div className="w-full max-w-5xl mb-8 overflow-x-auto pb-2">
                <div className="flex gap-2">
                    {LEVELS.map(lvl => (
                        <button
                            key={lvl}
                            onClick={() => handleLevelChange(lvl)}
                            className={`px-4 py-2 rounded-full font-bold text-sm transition whitespace-nowrap
                ${currentLevel === lvl
                                    ? 'bg-red-500 text-white shadow-md scale-105'
                                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}
              `}
                        >
                            {lvl === 'ALL' ? 'すべて' : `Level ${lvl}`}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="p-10 text-center text-gray-500">Loading...</div>
            ) : (
                <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
                    {/* 単語帳 */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold mb-4 text-blue-600 border-b pb-2">📚 Vocabulary ({wordbooks.length})</h2>
                        {wordbooks.length === 0 && <p className="text-gray-400 text-sm">このレベルの単語帳はありません。</p>}
                        <div className="space-y-3">
                            {wordbooks.map((book) => (
                                <Link key={book.id} href={`/drill/word/${book.id}`} className="block p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition border border-blue-100">
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-lg text-gray-800">{book.title}</div>
                                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">{book.level}</span>
                                    </div>
                                    <div className="text-sm text-gray-500">{book.description}</div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* 問題集 */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold mb-4 text-red-600 border-b pb-2">✍️ Exercises ({exercises.length})</h2>
                        {exercises.length === 0 && <p className="text-gray-400 text-sm">このレベルの問題集はありません。</p>}
                        <div className="space-y-3">
                            {exercises.map((ex) => (
                                <Link key={ex.id} href={`/drill/exam/${ex.id}`} className="block p-4 rounded-lg bg-red-50 hover:bg-red-100 transition border border-red-100">
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-lg text-gray-800">{ex.title}</div>
                                        <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">{ex.level}</span>
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">Category: {ex.category}</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}


