'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const handleAuthCallback = async () => {
            const { error } = await supabase.auth.getSession();
            if (error) {
                console.error('Error getting session:', error);
                alert('認証エラーが発生しました: ' + error.message);
            }
            // 成功しても失敗してもトップページへリダイレクト
            // セッションがあればミドルウェアや保護されたページで処理される
            router.push('/');
            router.refresh();
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
