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
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-5xl mx-auto relative z-10">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3 tracking-tight">
                        <span className="text-4xl">📚</span> {currentSubject} Vidnitive Reading
                    </h1>
                    <Link href="/" className="glass px-6 py-2 rounded-xl font-bold text-indigo-600 hover:bg-white/50 transition">← Studio</Link>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {readings.map((item) => (
                        <Link
                            key={item.id}
                            href={`/reading/view?id=${item.id}`}
                            className="group block glass-card p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${item.category === 'novel' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {item.category}
                                </span>
                                <span className="text-xs font-bold text-gray-400 bg-white/50 px-2 py-1 rounded">{item.level}</span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-indigo-600 transition line-clamp-2">{item.title}</h2>
                            <p className="text-gray-500 text-sm line-clamp-3 leading-relaxed">{item.content}</p>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                                <span className="text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition flex items-center gap-1">Read Now →</span>
                            </div>
                        </Link>
                    ))}
                    {readings.length === 0 && (
                        <div className="col-span-full text-center py-20 glass-card">
                            <p className="text-xl font-bold text-gray-400 mb-2">No readings found</p>
                            <p className="text-gray-400">Wait for admin to add content.</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}