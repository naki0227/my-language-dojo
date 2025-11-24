'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true); // ログインか登録か
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (isLogin) {
            // ログイン処理
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                alert('ログイン失敗: ' + error.message);
            } else {
                router.push('/'); // トップページへ
                router.refresh();
            }
        } else {
            // 新規登録処理
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) {
                alert('登録失敗: ' + error.message);
            } else {
                alert('登録成功！ログインしました。');
                router.push('/');
            }
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
                    {isLogin ? 'My Dojoにログイン' : '新規アカウント作成'}
                </h1>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 border rounded-lg outline-none focus:border-blue-500 text-black"
                            placeholder="hello@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border rounded-lg outline-none focus:border-blue-500 text-black"
                            placeholder="6文字以上"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-400"
                    >
                        {loading ? '処理中...' : (isLogin ? 'ログイン' : 'アカウント作成')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-blue-500 text-sm hover:underline"
                    >
                        {isLogin ? 'アカウントをお持ちでない方はこちら' : 'すでにアカウントをお持ちの方はこちら'}
                    </button>
                </div>
            </div>
        </main>
    );
}
