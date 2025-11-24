'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import EmbeddedPlayer from '@/components/EmbeddedPlayer';
import CommentSection from '@/components/CommentSection'; // 追加
import { useParams } from 'next/navigation';

type Textbook = {
    id: number;
    title: string;
    content: string;
    created_at: string;
    related_wordbook_id: number | null; // 追加
};

export default function TextbookViewer() {
    const { id } = useParams();
    const [book, setBook] = useState<Textbook | null>(null);

    useEffect(() => {
        const fetchBook = async () => {
            const { data } = await supabase
                .from('textbooks')
                .select('*')
                .eq('id', id)
                .single();
            if (data) setBook(data);
        };
        if (id) fetchBook();
    }, [id]);

    if (!book) return <div className="p-10 text-center">Loading textbook...</div>;

    const renderContent = (text: string) => {
        const regex = /\[\[video:(.*?):(\d+):(.*?)]]/g;
        const parts = text.split(regex);

        return parts.map((part, i) => {
            if (i % 4 === 1) {
                const videoId = parts[i];
                const start = parseInt(parts[i + 1]);
                const title = parts[i + 2];
                return <EmbeddedPlayer key={i} videoId={videoId} start={start} title={title} />;
            }
            if (i % 4 === 2 || i % 4 === 3) return null;
            return (
                <div key={i} className="prose max-w-none my-4">
                    <ReactMarkdown>{part}</ReactMarkdown>
                </div>
            );
        });
    };

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-3xl mb-6">
                <Link href="/textbook" className="text-blue-500 hover:underline">← 一覧に戻る</Link>
            </div>

            <article className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8 md:p-12 mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 border-b pb-4">
                    {book.title}
                </h1>
                <p className="text-xs text-gray-400 mb-10 text-right">
                    作成日: {new Date(book.created_at).toLocaleDateString()}
                </p>

                {/* 本文 */}
                <div className="text-gray-800 leading-relaxed space-y-6">
                    {renderContent(book.content)}
                </div>

                {/* ドリルへのリンク (関連付けられている場合のみ表示) */}
                {book.related_wordbook_id && (
                    <div className="mt-12 p-6 bg-green-50 rounded-xl border border-green-200 text-center">
                        <h3 className="text-lg font-bold text-green-800 mb-2">💪 この単元の単語をマスターしよう！</h3>
                        <Link
                            href={`/drill/word/${book.related_wordbook_id}`}
                            className="inline-block bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-green-700 transition transform hover:-translate-y-1"
                        >
                            単語練習に進む →
                        </Link>
                    </div>
                )}
            </article>

            {/* コメント欄 (教科書IDを渡す) */}
            <div className="w-full max-w-3xl">
                <CommentSection textbookId={book.id} />
            </div>
        </main>
    );
}


