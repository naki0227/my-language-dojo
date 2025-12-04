'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { PenTool, CheckCircle, RefreshCw, Save } from 'lucide-react';

const TOPICS = [
    'Self Introduction', 'My Dream', 'Favorite Movie', 'Travel Experience',
    'Why I learn languages', 'Technology and Future', 'Daily Routine'
];

export default function WritingPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [topic, setTopic] = useState(TOPICS[0]);
    const [text, setText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [targetSubject, setTargetSubject] = useState('English');

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
                const { data } = await supabase.from('profiles').select('learning_target').eq('id', session.user.id).single();
                if (data) setTargetSubject(data.learning_target);
            }
        };
        init();
    }, []);

    const handleAnalyze = async () => {
        if (!text.trim()) return;
        setIsAnalyzing(true);
        setResult(null);

        try {
            const res = await fetch('/api/ai/writing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, topic, targetSubject })
            });
            const data = await res.json();
            setResult(data);

            // ログ保存
            if (userId) {
                await supabase.from('writing_logs').insert({
                    user_id: userId,
                    topic,
                    original_text: text,
                    corrected_text: data.corrected,
                    feedback: data.feedback,
                    score: data.score
                });
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-4xl relative z-10">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3 tracking-tight">
                        <span className="text-4xl text-indigo-600"><PenTool /></span> Vidnitive Writing ({targetSubject})
                    </h1>
                    <Link href="/" className="glass px-6 py-2 rounded-xl font-bold text-indigo-600 hover:bg-white/50 transition">← Studio</Link>
                </div>

                {/* 入力エリア */}
                <div className="glass-card p-8 mb-8">
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Topic</label>
                        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-4 rounded-xl bg-white/50 border border-white/20 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-400 outline-none transition">
                            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Write about "${topic}" in ${targetSubject}...`}
                        className="w-full h-64 p-6 rounded-xl bg-white/50 border border-white/20 focus:ring-2 focus:ring-indigo-400 outline-none resize-none text-lg mb-6 placeholder-gray-400 transition"
                    />

                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !text}
                        className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition transform hover:scale-[1.02]
                ${isAnalyzing ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-xl'}
             `}
                    >
                        {isAnalyzing ? (
                            <span className="flex items-center justify-center gap-2">
                                <RefreshCw className="animate-spin" /> AI is correcting...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                ✍️ Submit for Correction
                            </span>
                        )}
                    </button>
                </div>

                {/* 結果エリア */}
                {result && (
                    <div className="glass-card p-8 border-l-8 border-green-500 animate-slide-up">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-2xl font-bold text-green-600 flex items-center gap-2"><CheckCircle /> Result</h2>
                            <span className="text-5xl font-black text-indigo-900 tracking-tighter">{result.score}<span className="text-lg text-gray-400 font-medium ml-1">/100</span></span>
                        </div>

                        <div className="mb-8">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Corrected Text</p>
                            <div className="text-xl font-medium text-gray-800 leading-relaxed bg-green-50/50 p-6 rounded-xl border border-green-100">
                                {result.corrected}
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Feedback</p>
                            <p className="text-gray-600 leading-relaxed">{result.feedback}</p>
                        </div>

                        <div className="space-y-3 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                            {result.points?.map((p: string, i: number) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-indigo-700 font-medium">
                                    <span className="text-indigo-400 mt-1">•</span><span>{p}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

