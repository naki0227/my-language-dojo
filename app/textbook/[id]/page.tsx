'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import EmbeddedPlayer from '@/components/EmbeddedPlayer';
import { useParams } from 'next/navigation';

type Textbook = {
    id: number;
    title: string;
    content: string;
    created_at: string;
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

    // --- コンテンツの解析 (動画タグをプレイヤーに変換) ---
    // ルール: [[video:ID:開始秒:タイトル]] を探す
    const renderContent = (text: string) => {
        const regex = /\[\[video:(.*?):(\d+):(.*?)]]/g;
        const parts = text.split(regex);

        return parts.map((part, i) => {
            // 4つごとに動画情報のセットが来る
            if (i % 4 === 1) {
                const videoId = parts[i];
                const start = parseInt(parts[i + 1]);
                const title = parts[i + 2];
                return <EmbeddedPlayer key={i} videoId={videoId} start={start} title={title} />;
            }
            // 動画情報の断片はスキップ
            if (i % 4 === 2 || i % 4 === 3) return null;

            // 通常のテキスト
            // 修正: ReactMarkdownに直接classNameをつけず、divで囲む
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

            <article className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8 md:p-12">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 border-b pb-4">
                    {book.title}
                </h1>
                <p className="text-xs text-gray-400 mb-10 text-right">
                    作成日: {new Date(book.created_at).toLocaleDateString()}
                </p>

                {/* 本文エリア */}
                <div className="text-gray-800 leading-relaxed space-y-6">
                    {renderContent(book.content)}
                </div>
            </article>
        </main>
    );
}


