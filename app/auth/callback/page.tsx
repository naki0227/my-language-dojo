'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();

    const [debugInfo, setDebugInfo] = useState<string>('Initializing...');

    useEffect(() => {
        const handleAuthCallback = async () => {
            setDebugInfo('Checking session...');

            // ハッシュフラグメントがあるかチェック
            const hash = window.location.hash;
            if (!hash) {
                setDebugInfo('No hash found in URL.');
            } else {
                setDebugInfo('Hash found. Processing...');
            }

            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth event:', event);
                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    setDebugInfo(`Event: ${event}. Redirecting...`);
                    router.push('/');
                    router.refresh();
                }
            });

            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Error getting session:', error);
                setDebugInfo(`Error: ${error.message}`);
            } else if (session) {
                setDebugInfo('Session found via getSession. Redirecting...');
                router.push('/');
                router.refresh();
            } else {
                setDebugInfo('No session found yet. Waiting for event...');
            }

            return () => {
                subscription.unsubscribe();
            };
        };

        handleAuthCallback();
    }, [router]);

    const handleManualRedirect = () => {
        router.push('/');
        router.refresh();
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Authenticating...</h2>
            <p className="text-gray-600 mb-4">Please wait while we log you in.</p>

            <div className="bg-gray-100 p-4 rounded-lg text-xs font-mono text-gray-700 max-w-lg w-full overflow-auto mb-4">
                <p>Status: {debugInfo}</p>
            </div>

            <button
                onClick={handleManualRedirect}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
                Go to Home (Manual)
            </button>
        </div>
    );
}
