'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        // ハッシュフラグメントがあるかチェック
        // SupabaseのOAuthリダイレクトは通常ハッシュにトークンを含みます
        const handleAuthCallback = async () => {
            // セッションの確立を待つ
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    // ログイン成功
                    router.push('/');
                    router.refresh();
                }
            });

            // 万が一イベントが発火しない場合のために、手動でもチェック
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Error getting session:', error);
                // エラー表示はユーザー体験を損なう可能性があるため、コンソールのみにしてリダイレクトを試みる
            }
            if (session) {
                router.push('/');
                router.refresh();
            }

            return () => {
                subscription.unsubscribe();
            };
        };

        handleAuthCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-gray-600">Authenticating...</span>
        </div>
    );
}
