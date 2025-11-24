'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ArchivePage() {
    const [archives, setArchives] = useState<any[]>([]);

    useEffect(() => {
        const fetchArchives = async () => {
            const { data } = await supabase
                .from('daily_picks')
                .select('*')
                .order('date', { ascending: false }); // 新しい順
            if (data) setArchives(data);
        };
        fetchArchives();
    }, []);

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">📅 Past Daily Picks</h1>
                    <Link href="/dashboard" className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">← Back</Link>
                </div>

                <div className="space-y-4">
                    {archives.map((pick) => (
                        <Link
                            key={pick.id}
                            href={`/?videoId=${pick.video_id}`}
                            className="block bg-white p-6 rounded-xl shadow-sm hover:shadow-md border border-transparent hover:border-purple-300 transition group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs text-gray-400 font-bold mb-1">{pick.date}</p>
                                    <p className="text-lg font-bold text-gray-800 group-hover:text-purple-600">{pick.message}</p>
                                </div>
                                <span className="text-2xl opacity-50 group-hover:scale-125 transition">🎁</span>
                            </div>
                            {pick.quiz_data && (
                                <div className="mt-3 inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">
                                    🧩 クイズあり
                                </div>
                            )}
                        </Link>
                    ))}
                    {archives.length === 0 && <p className="text-center text-gray-400">アーカイブはありません</p>}
                </div>
            </div>
        </main>
    );
}

