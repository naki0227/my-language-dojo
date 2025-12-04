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
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-lg relative z-10">
                <div className="glass-card p-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <span className="text-4xl">📮</span> Contact Vidnitive
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wider">Category</label>
                            <div className="relative">
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full p-4 rounded-xl bg-white/50 border border-white/20 font-bold text-gray-700 focus:ring-2 focus:ring-blue-400 outline-none appearance-none transition"
                                >
                                    <option value="request">✨ Feature Request</option>
                                    <option value="bug">🐛 Bug Report</option>
                                    <option value="other">🤔 Other</option>
                                </select>
                                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
                                    ▼
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wider">Message</label>
                            <textarea
                                required
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full h-40 p-4 rounded-xl bg-white/50 border border-white/20 outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 placeholder-gray-400 resize-none transition"
                                placeholder="How can we help you?"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !message}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition transform hover:scale-[1.02]
                    ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl'}
                  `}
                        >
                            {isSubmitting ? 'Sending...' : 'Send Message'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <Link href="/" className="text-gray-500 hover:text-blue-600 font-bold transition text-sm">Cancel & Return to Studio</Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

