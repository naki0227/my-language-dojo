'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function WordDrillContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const [words, setWords] = useState<any[]>([]);
    const [index, setIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        const fetchWords = async () => {
            if (!id) return;
            const { data } = await supabase.from('wordbook_entries').select('*').eq('wordbook_id', id);
            if (data) setWords(data);
        };
        fetchWords();
    }, [id]);

    if (words.length === 0) return <div className="p-10 text-center">Loading...</div>;
    const current = words[index];

    return (
        <main className="min-h-screen bg-gray-100 p-8 flex flex-col items-center justify-center">
            <Link href="/drill" className="absolute top-8 left-8 text-gray-500 hover:text-black">× 終了</Link>

            <div className="mb-4 text-gray-500 font-bold">{index + 1} / {words.length}</div>

            <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-md h-80 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center p-8 cursor-pointer transition-transform transform active:scale-95"
            >
                {!isFlipped ? (
                    <>
                        <h2 className="text-4xl font-bold text-gray-800 mb-2">{current.word}</h2>
                        <p className="text-sm text-gray-400 mt-4">(タップして意味を表示)</p>
                    </>
                ) : (
                    <div className="text-center animate-fade-in">
                        <h3 className="text-3xl font-bold text-blue-600 mb-4">{current.meaning}</h3>
                        <p className="text-gray-600 italic">"{current.example}"</p>
                    </div>
                )}
            </div>

            <div className="flex gap-4 mt-8 w-full max-w-md">
                <button
                    onClick={() => { setIndex((prev) => Math.max(0, prev - 1)); setIsFlipped(false); }}
                    disabled={index === 0}
                    className="flex-1 py-3 bg-gray-300 rounded-lg font-bold disabled:opacity-50"
                >
                    ← 前へ
                </button>
                <button
                    onClick={() => {
                        if (index < words.length - 1) {
                            setIndex(index + 1);
                            setIsFlipped(false);
                        } else {
                            alert('完了！お疲れ様でした 🎉');
                        }
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                >
                    次へ →
                </button>
            </div>
        </main>
    );
}

export default function WordDrill() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <WordDrillContent />
        </Suspense>
    );
}
