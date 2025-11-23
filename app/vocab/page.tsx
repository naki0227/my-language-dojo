// app/vocab/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Vocab = {
    id: number;
    word: string;
    translation: string;
    created_at: string;
};

export default function VocabPage() {
    const [vocabList, setVocabList] = useState<Vocab[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 初回読み込み
    useEffect(() => {
        fetchVocab();
    }, []);

    const fetchVocab = async () => {
        setIsLoading(true);
        // created_at の新しい順 (desc) で取得
        const { data, error } = await supabase
            .from('vocab')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            alert('データの取得に失敗しました');
        } else {
            setVocabList(data || []);
        }
        setIsLoading(false);
    };

    // 削除機能
    const handleDelete = async (id: number) => {
        const confirmDelete = confirm('本当に削除しますか？');
        if (!confirmDelete) return;

        const { error } = await supabase
            .from('vocab')
            .delete()
            .eq('id', id);

        if (error) {
            alert('削除に失敗しました');
        } else {
            // 画面からも消す
            setVocabList(vocabList.filter((v) => v.id !== id));
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">My Wordbook 📚</h1>
                <Link
                    href="/"
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
                >
                    ← 動画に戻る
                </Link>
            </div>

            <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading words...</div>
                ) : vocabList.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-xl text-gray-600 mb-4">まだ単語が登録されていません。</p>
                        <Link href="/" className="text-blue-500 hover:underline">
                            動画を見て単語を探そう！
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {vocabList.map((item) => (
                            <div key={item.id} className="p-6 flex justify-between items-center hover:bg-gray-50 transition">
                                <div>
                                    <h2 className="text-2xl font-bold text-blue-800">{item.word}</h2>
                                    <p className="text-gray-600 mt-1">{item.translation}</p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        登録日: {new Date(item.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1 rounded text-sm transition"
                                >
                                    削除
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
