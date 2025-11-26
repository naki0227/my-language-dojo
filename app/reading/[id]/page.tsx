'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ReadingViewer() {
    const { id } = useParams();
    const [reading, setReading] = useState<any>(null);
    const [isBookmarked, setIsBookmarked] = useState(false);

    // 辞書用
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [translation, setTranslation] = useState<string | null>(null);

    useEffect(() => {
        const fetchReading = async () => {
            const { data } = await supabase.from('readings').select('*').eq('id', id).single();
            if (data) setReading(data);

            // しおり確認
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: bm } = await supabase.from('reading_bookmarks').select('id').match({ user_id: session.user.id, reading_id: id }).single();
                if (bm) setIsBookmarked(true);
            }
        };
        fetchReading();
    }, [id]);

    const toggleBookmark = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        if (isBookmarked) {
            await supabase.from('reading_bookmarks').delete().match({ user_id: session.user.id, reading_id: id });
            setIsBookmarked(false);
        } else {
            await supabase.from('reading_bookmarks').insert({ user_id: session.user.id, reading_id: id });
            setIsBookmarked(true);
        }
    };

    const handleWordClick = async (word: string) => {
        // 記号除去
        const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
        if (!clean) return;
        setSelectedWord(clean);
        setTranslation("Translating...");

        // AI辞書API呼び出し
        const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: clean, targetLang: reading.subject })
        });
        const data = await res.json();
        setTranslation(data.translation);
    };

    if (!reading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <main className="min-h-screen bg-yellow-50 p-4 md:p-8 flex flex-col items-center font-serif">
            <div className="w-full max-w-3xl mb-6 flex justify-between items-center">
                <Link href="/reading" className="text-gray-500 hover:underline">← Back</Link>
                <button
                    onClick={toggleBookmark}
                    className={`px-4 py-2 rounded-full font-bold transition ${isBookmarked ? 'bg-pink-500 text-white' : 'bg-white border border-gray-300 text-gray-500'}`}
                >
                    {isBookmarked ? '🔖 Shiori (Saved)' : '🔖 Shiori'}
                </button>
            </div>

            <article className="w-full max-w-3xl bg-white p-8 md:p-16 shadow-xl rounded-sm">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">{reading.title}</h1>

                <div className="text-lg leading-loose text-gray-800 space-y-6">
                    {/* 本文を単語ごとに分割してクリッカブルにする */}
                    {reading.content.split('\n').map((para: string, i: number) => (
                        <p key={i}>
                            {para.split(' ').map((word, j) => (
                                <span
                                    key={j}
                                    onClick={() => handleWordClick(word)}
                                    className="hover:bg-yellow-200 cursor-pointer rounded px-0.5 transition"
                                >
                                    {word}{' '}
                                </span>
                            ))}
                        </p>
                    ))}
                </div>
            </article>

            {/* 辞書ポップアップ */}
            {selectedWord && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-6 py-4 rounded-full shadow-2xl z-50 flex items-center gap-4 max-w-[90%] animate-slide-up">
                    <div>
                        <span className="font-bold text-lg mr-2">{selectedWord}</span>
                        <span className="text-gray-300">{translation}</span>
                    </div>
                    <button onClick={() => setSelectedWord(null)} className="text-gray-500 hover:text-white">×</button>
                </div>
            )}
        </main>
    );
}