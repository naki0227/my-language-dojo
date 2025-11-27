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
        <main className="min-h-screen bg-indigo-50 p-6 flex flex-col items-center font-sans text-gray-800">
            <div className="w-full max-w-3xl">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-indigo-700 flex items-center gap-2">
                        <PenTool /> Writing Dojo ({targetSubject})
                    </h1>
                    <Link href="/" className="text-gray-500 hover:text-indigo-600">Exit</Link>
                </div>

                {/* 入力エリア */}
                <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-500 mb-2">Topic</label>
                        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-3 rounded-lg bg-gray-50 border border-gray-200 font-bold">
                            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Write about "${topic}" in ${targetSubject}...`}
                        className="w-full h-48 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-lg mb-4"
                    />

                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !text}
                        className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition
                ${isAnalyzing ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-500'}
             `}
                    >
                        {isAnalyzing ? 'AI is correcting...' : '✍️ Submit for Correction'}
                    </button>
                </div>

                {/* 結果エリア */}
                {result && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl border-l-8 border-green-500 animate-slide-up">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h2 className="text-2xl font-bold text-green-600 flex items-center gap-2"><CheckCircle /> Result</h2>
                            <span className="text-4xl font-black text-indigo-900">{result.score}<span className="text-lg text-gray-400">/100</span></span>
                        </div>

                        <div className="mb-6">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Corrected Text</p>
                            <p className="text-xl font-medium text-gray-800 leading-relaxed bg-green-50 p-4 rounded-lg">
                                {result.corrected}
                            </p>
                        </div>

                        <div className="mb-4">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Feedback</p>
                            <p className="text-gray-600">{result.feedback}</p>
                        </div>

                        <div className="space-y-2">
                            {result.points?.map((p: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-indigo-600">
                                    <span>•</span><span>{p}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

