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

    const handleGoogleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            alert('Googleログイン失敗: ' + error.message);
            setLoading(false);
        }
        // Redirect happens automatically, so no need to setLoading(false) on success immediately
    };

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
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in relative overflow-hidden">
                {/* Decorative background blob */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>

                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 tracking-tight">
                        {isLogin ? 'Welcome Back' : 'Join My Dojo'}
                    </h1>

                    <form onSubmit={handleAuth} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 bg-white/50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition text-gray-800 placeholder-gray-400"
                                placeholder="hello@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 bg-white/50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition text-gray-800 placeholder-gray-400"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300/50"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-transparent text-gray-500 font-medium">Or continue with</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 hover:shadow-md transition-all disabled:opacity-70"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 4.63c1.61 0 3.06.56 4.21 1.64l3.16-3.16C17.45 1.18 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Googleでログイン
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-indigo-600 text-sm font-semibold hover:text-indigo-800 transition"
                        >
                            {isLogin ? 'Create an account' : 'Already have an account?'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
