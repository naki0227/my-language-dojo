'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import EmbeddedPlayer from '@/components/EmbeddedPlayer';
import CommentSection from '@/components/CommentSection';
import { useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { DictionaryData } from '@/types';

type Textbook = {
    id: number; title: string; content: string; created_at: string; related_wordbook_id: number | null; subject: string;
};

function TextbookViewerContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const [book, setBook] = useState<Textbook | null>(null);

    // ★辞書用ステート
    const [dictQuery, setDictQuery] = useState('');
    const [dictResult, setDictResult] = useState<DictionaryData | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);

    useEffect(() => {
        const fetchBook = async () => {
            if (!id) return;
            const { data } = await supabase.from('textbooks').select('*').eq('id', id).single();
            if (data) setBook(data);
        };
        fetchBook();
    }, [id]);

    // ★AI辞書検索
    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dictQuery.trim() || !book) return;
        setIsLookingUp(true);
        setDictResult(null);

        try {
            const res = await fetch(getApiUrl('/api/ai/analyze'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word: dictQuery, targetLang: book.subject })
            });
            const data = await res.json();
            setDictResult(data);
        } catch (e) { alert('検索エラー'); }
        finally { setIsLookingUp(false); }
    };

    // ★単語保存
    const handleSaveWord = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !dictResult || !book) return;
        await supabase.from('vocab').insert([{
            user_id: session.user.id,
            word: dictQuery,
            translation: dictResult.translation,
            subject: book.subject
        }]);
        alert('単語帳に保存しました！');
        setDictQuery(''); setDictResult(null);
    };

    if (!book) return <div className="p-10 text-center">Loading...</div>;

    const renderContent = (text: string) => {
        const regex = /\[\[video:(.*?):(\d+):(.*?)]]/g;
        const parts = text.split(regex);
        return parts.map((part, i) => {
            if (i % 4 === 1) return <EmbeddedPlayer key={i} videoId={parts[i]} start={parseInt(parts[i + 1])} title={parts[i + 2]} />;
            if (i % 4 === 2 || i % 4 === 3) return null;
            return <div key={i} className="prose max-w-none my-4"><ReactMarkdown>{part}</ReactMarkdown></div>;
        });
    };

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-3xl mb-4 flex justify-between items-center">
                <Link href="/textbook" className="text-blue-500 hover:underline">← 一覧</Link>
                <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs">{book.subject}</span>
            </div>

            {/* ★辞書検索バー (Sticky) ★ */}
            <div className="w-full max-w-3xl bg-white p-3 rounded-xl shadow-sm mb-6 sticky top-4 z-40 border border-blue-100">
                <form onSubmit={handleLookup} className="flex gap-2">
                    <input
                        type="text"
                        value={dictQuery}
                        onChange={(e) => setDictQuery(e.target.value)}
                        placeholder={`辞書 (${book.subject})...`}
                        className="flex-1 border p-2 rounded-lg text-black text-sm"
                    />
                    <button type="submit" disabled={isLookingUp} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:bg-gray-300">
                        {isLookingUp ? '...' : '🔍'}
                    </button>
                </form>
                {dictResult && (
                    <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 flex justify-between items-center animate-fade-in">
                        <div className="text-sm">
                            <span className="font-bold text-blue-800">{dictQuery}</span>
                            <span className="mx-1 text-gray-400">=</span>
                            <span className="text-black">{dictResult.translation}</span>
                        </div>
                        <button onClick={handleSaveWord} className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-green-600">＋ Save</button>
                    </div>
                )}
            </div>

            <article className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8 md:p-12 mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 border-b pb-4">{book.title}</h1>
                <div className="text-gray-800 leading-relaxed space-y-6">{renderContent(book.content)}</div>

                {book.related_wordbook_id && (
                    <div className="mt-12 p-6 bg-green-50 rounded-xl border border-green-200 text-center">
                        <h3 className="text-lg font-bold text-green-800 mb-2">💪 この単元の単語帳</h3>
                        <Link href={`/drill/word/view?id=${book.related_wordbook_id}`} className="inline-block bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow hover:bg-green-700">
                            単語練習に進む →
                        </Link>
                    </div>
                )}
            </article>

            <div className="w-full max-w-3xl"><CommentSection textbookId={book.id} /></div>
        </main>
    );
}

export default function TextbookViewer() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TextbookViewerContent />
        </Suspense>
    );
}
