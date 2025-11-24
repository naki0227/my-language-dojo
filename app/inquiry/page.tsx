'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function InquiryPage() {
    const router = useRouter();
    const [category, setCategory] = useState('request');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) setUserId(session.user.id);
        };
        checkUser();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        setIsSubmitting(true);

        const { error } = await supabase
            .from('inquiries')
            .insert([{ user_id: userId, category, message }]);

        if (error) {
            alert('送信エラー: ' + error.message);
        } else {
            alert('送信しました！ご意見ありがとうございます。');
            router.push('/');
        }
        setIsSubmitting(false);
    };

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">📮 お問い合わせ</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">カテゴリ</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full p-3 border rounded-lg bg-white text-black"
                        >
                            <option value="request">✨ 機能の要望</option>
                            <option value="bug">🐛 バグ報告</option>
                            <option value="other">🤔 その他</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">メッセージ</label>
                        <textarea
                            required
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full h-40 p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black"
                            placeholder="ここに入力してください..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !message}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition"
                    >
                        {isSubmitting ? '送信中...' : '送信する'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link href="/" className="text-gray-500 hover:text-gray-800 text-sm">キャンセルして戻る</Link>
                </div>
            </div>
        </main>
    );
}

