'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Supporter = {
    id: string;
    username: string;
    supporter_tier: string;
    supporter_message: string;
    supporter_amount: number;
};

export default function SupportersPage() {
    const [supporters, setSupporters] = useState<Supporter[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSupporters = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, username, supporter_tier, supporter_message, supporter_amount')
                .not('supporter_tier', 'is', null)
                .order('supporter_amount', { ascending: false });

            if (data) {
                setSupporters(data as Supporter[]);
            }
            setIsLoading(false);
        };
        fetchSupporters();
    }, []);

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-5xl relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-black text-gray-800 mb-4 tracking-tight">Our Supporters 🏆</h1>
                    <p className="text-xl text-gray-600 font-medium">Thank you to everyone who supports Vidnitive!</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-3 gap-6">
                        {supporters.length > 0 ? (
                            supporters.map((supporter) => (
                                <div key={supporter.id} className="glass-card p-6 flex flex-col items-center text-center hover:scale-[1.02] transition-transform duration-300">
                                    <div className={`
                                        w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg
                                        ${supporter.supporter_tier === 'gold' ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white' :
                                            supporter.supporter_tier === 'silver' ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                                                'bg-gradient-to-br from-orange-300 to-orange-500 text-white'}
                                    `}>
                                        {supporter.supporter_tier === 'gold' ? '👑' :
                                            supporter.supporter_tier === 'silver' ? '🥈' : '🥉'}
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-1">{supporter.username}</h3>
                                    <span className={`
                                        text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-4
                                        ${supporter.supporter_tier === 'gold' ? 'bg-yellow-100 text-yellow-700' :
                                            supporter.supporter_tier === 'silver' ? 'bg-gray-100 text-gray-700' :
                                                'bg-orange-100 text-orange-700'}
                                    `}>
                                        {supporter.supporter_tier} Supporter
                                    </span>
                                    {supporter.supporter_message && (
                                        <p className="text-gray-600 italic">"{supporter.supporter_message}"</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="col-span-3 text-center py-20 glass-card">
                                <p className="text-xl font-bold text-gray-400 mb-2">No supporters yet</p>
                                <p className="text-gray-400">Be the first to support us!</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-12 text-center">
                    <Link href="/" className="text-gray-500 hover:text-indigo-600 font-bold transition">← Back to Studio</Link>
                </div>
            </div>
        </main>
    );
}
