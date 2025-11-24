'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DrillIndex() {
    const router = useRouter();
    const [wordbooks, setWordbooks] = useState<any[]>([]);
    const [exercises, setExercises] = useState<any[]>([]);
    const [targetSubject, setTargetSubject] = useState('English');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }

            // ユーザーの学習対象言語を取得
            const { data: profile } = await supabase.from('profiles').select('learning_target').eq('id', session.user.id).single();
            const currentSubject = profile?.learning_target || 'English';
            setTargetSubject(currentSubject);

            // 学習対象言語でフィルタリングしてデータを取得
            const { data: wb } = await supabase.from('wordbooks').select('*').eq('subject', currentSubject);
            const { data: ex } = await supabase.from('exercises').select('*').eq('subject', currentSubject);

            if (wb) setWordbooks(wb);
            if (ex) setExercises(ex);
            setIsLoading(false);
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl mb-8 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    🔥 {targetSubject} ドリル
                </h1>
                <Link href="/" className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">← Home</Link>
            </div>

            {isLoading ? (
                <p className="text-gray-500">Loading drills...</p>
            ) : (
                <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">
                    {/* 単語帳セクション */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold mb-4 text-blue-600 border-b pb-2">📚 単語練習帳 ({wordbooks.length} Packs)</h2>
                        {wordbooks.length === 0 && <p className="text-gray-400">データがありません。</p>}
                        <div className="space-y-3">
                            {wordbooks.map((book) => (
                                <Link
                                    key={book.id}
                                    href={`/drill/word/${book.id}`}
                                    className="block p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition border border-blue-100"
                                >
                                    <div className="font-bold text-lg text-gray-800">{book.title}</div>
                                    <div className="text-sm text-gray-500">{book.description}</div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* 問題集セクション */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold mb-4 text-red-600 border-b pb-2">✍️ 文法・長文演習 ({exercises.length} Exams)</h2>
                        {exercises.length === 0 && <p className="text-gray-400">データがありません。</p>}
                        <div className="space-y-3">
                            {exercises.map((ex) => (
                                <Link
                                    key={ex.id}
                                    href={`/drill/exam/${ex.id}`}
                                    className="block p-4 rounded-lg bg-red-50 hover:bg-red-100 transition border border-red-100"
                                >
                                    <div className="font-bold text-lg text-gray-800">{ex.title}</div>
                                    <div className="text-sm text-gray-500 flex gap-2 mt-1">
                                        <span className="bg-white px-2 py-0.5 rounded border text-xs uppercase">{ex.category}</span>
                                        <span className="bg-white px-2 py-0.5 rounded border text-xs">{ex.level}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

