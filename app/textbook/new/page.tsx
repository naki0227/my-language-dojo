'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreateTextbook() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) router.push('/auth');
            else setUserId(session.user.id);
        };
        checkUser();
    }, [router]);

    const handleSave = async () => {
        if (!title || !content || !userId) return;
        setIsSaving(true);

        const { error } = await supabase
            .from('textbooks')
            .insert([{ user_id: userId, title, content }]);

        if (error) {
            alert('保存エラー: ' + error.message);
        } else {
            alert('教科書を作成しました！');
            router.push('/textbook');
        }
        setIsSaving(false);
    };

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl mb-6">
                <Link href="/textbook" className="text-blue-500 hover:underline">← 一覧に戻る</Link>
            </div>

            <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">教科書を作成 ✏️</h1>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">タイトル</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-3 border rounded-lg text-black font-bold text-lg"
                            placeholder="例: 現在完了形の使い方"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            内容 (Markdown)
                            <span className="text-xs font-normal text-gray-500 ml-2">※ `[[video:動画ID]]` と書くと動画を埋め込めます</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-[400px] p-4 border rounded-lg text-black font-mono text-sm leading-relaxed"
                            placeholder="# 見出し&#13;&#10;ここに解説を書きます。&#13;&#10;&#13;&#10;[[video:arj7oStGLkU]]"
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving || !title || !content}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300"
                    >
                        {isSaving ? '保存中...' : '教科書を保存する'}
                    </button>
                </div>
            </div>
        </main>
    );
}

