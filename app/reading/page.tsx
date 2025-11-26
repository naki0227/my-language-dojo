'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ReadingList() {
    const router = useRouter();
    const [readings, setReadings] = useState<any[]>([]);
    const [currentSubject, setCurrentSubject] = useState('English');

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }

            // 言語設定取得
            const { data: profile } = await supabase.from('profiles').select('learning_target').eq('id', session.user.id).single();
            const subject = profile?.learning_target || 'English';
            setCurrentSubject(subject);

            // 読み物取得 (言語でフィルタ)
            const { data } = await supabase.from('readings').select('*').eq('subject', subject).order('created_at', { ascending: false });
            if (data) setReadings(data);
        };
        init();
    }, [router]);

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl mb-8 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">📚 {currentSubject} Library (Reading)</h1>
                <Link href="/" className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">← Home</Link>
            </div>

            <div className="w-full max-w-4xl grid gap-6 md:grid-cols-2">
                {readings.map((item) => (
                    <Link
                        key={item.id}
                        href={`/reading/${item.id}`}
                        className="block bg-white p-6 rounded-xl shadow hover:shadow-md transition border border-gray-100 hover:border-indigo-300"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${item.category === 'novel' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {item.category}
                            </span>
                            <span className="text-xs text-gray-400">{item.level}</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">{item.title}</h2>
                        <p className="text-gray-500 text-sm line-clamp-3">{item.content}</p>
                    </Link>
                ))}
                {readings.length === 0 && <p className="text-gray-400 col-span-2 text-center py-20">まだ読み物がありません。管理者が追加するのを待ちましょう。</p>}
            </div>
        </main>
    );
}