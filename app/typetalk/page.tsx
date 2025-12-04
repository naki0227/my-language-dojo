'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Send, Clock, Zap, Award, MessageSquare } from 'lucide-react';

type Message = {
    role: 'user' | 'ai';
    text: string;
    score?: { grammar: number; naturalness: number; speed: number; };
    feedback?: string;
};

const TOPICS = ['Self Introduction', 'Travel Plans', 'Ordering Food', 'Hobbies', 'Job Interview'];

export default function TypeTalkPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: "Hi! I'm your AI partner. Let's chat! What topic shall we talk about?" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [topic, setTopic] = useState(TOPICS[0]);

    // タイピング計測用
    const [startTime, setStartTime] = useState<number | null>(null);
    // ★修正: textarea用に型を変更
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // 自動スクロール用Ref
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // 3秒ヒント用タイマー
    const [showHint, setShowHint] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // メッセージ更新時に自動スクロール
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages, loading]);

    // 入力開始時にタイマースタート
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!startTime && e.target.value.length > 0) {
            setStartTime(Date.now());
        }
        setInput(e.target.value);

        // ★追加: テキストエリアの高さを自動調整
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'; // 一旦リセット
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`; // 最大150pxまで伸びる
        }

        // 3秒間入力が止まったらヒントを出す
        if (timerRef.current) clearTimeout(timerRef.current);
        setShowHint(false);
        if (e.target.value.length === 0) {
            setStartTime(null);
        } else {
            timerRef.current = setTimeout(() => setShowHint(true), 3000);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;

        const timeTaken = startTime ? (Date.now() - startTime) / 1000 : 0;

        const userMsg: Message = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setStartTime(null);

        // 送信後に高さをリセット
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        if (timerRef.current) clearTimeout(timerRef.current);
        setShowHint(false);

        try {
            const res = await fetch('/api/ai/typetalk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.text, topic, typingTime: timeTaken })
            });
            const data = await res.json();

            const aiMsg: Message = {
                role: 'ai',
                text: data.reply,
                score: data.score,
                feedback: data.feedback
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            alert('Error occurred');
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    return (
        <main className="min-h-screen bg-gray-900 text-white flex flex-col font-sans relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-900/30 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-900/30 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            {/* ヘッダー */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-md shadow-md shrink-0 z-10">
                <h1 className="text-xl font-bold flex items-center gap-2 text-yellow-400 tracking-tight">
                    <Zap className="fill-current" /> Vidnitive TypeTalk
                </h1>
                <Link href="/" className="text-gray-400 text-sm hover:text-white transition font-bold">Exit</Link>
            </div>

            {/* トピック選択 */}
            <div className="p-3 border-b border-white/5 overflow-x-auto flex gap-2 scrollbar-hide shrink-0 z-10 bg-black/20 backdrop-blur-sm">
                {TOPICS.map(t => (
                    <button
                        key={t} onClick={() => setTopic(t)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm
                ${topic === t ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* チャットエリア */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth z-10">
                {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-slide-up`}>
                        {/* ★修正: 改行コードを反映させるスタイル (whitespace-pre-wrap) */}
                        <div className={`max-w-[85%] p-4 rounded-2xl text-base leading-relaxed shadow-lg whitespace-pre-wrap backdrop-blur-sm
                ${m.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-none border border-white/10' : 'bg-white/10 text-gray-100 rounded-bl-none border border-white/5'}`}>
                            {m.text}
                        </div>

                        {/* スコアカード */}
                        {m.role === 'ai' && m.score && (
                            <div className="mt-3 bg-black/40 p-4 rounded-xl border border-white/10 text-xs w-full max-w-xs animate-fade-in backdrop-blur-md shadow-xl">
                                <div className="flex justify-between mb-3 border-b border-white/10 pb-2">
                                    <span className="text-yellow-400 font-bold flex items-center gap-1 text-sm"><Award size={16} /> Review</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                                    <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-gray-400 mb-1 font-bold">SPEED</div><div className={`font-black text-lg ${m.score.speed >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>{m.score.speed}/5</div></div>
                                    <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-gray-400 mb-1 font-bold">GRAMMAR</div><div className={`font-black text-lg ${m.score.grammar >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>{m.score.grammar}/5</div></div>
                                    <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-gray-400 mb-1 font-bold">NATURAL</div><div className={`font-black text-lg ${m.score.naturalness >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>{m.score.naturalness}/5</div></div>
                                </div>
                                {m.feedback && <p className="text-gray-300 border-t border-white/10 pt-2 mt-1 leading-relaxed">💡 {m.feedback}</p>}
                            </div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm animate-pulse ml-2">
                        <MessageSquare size={16} /> AI is typing...
                    </div>
                )}
                <div className="h-4" />
            </div>

            {/* 入力エリア */}
            <div className="p-4 border-t border-white/10 pb-8 md:pb-4 shrink-0 z-20 bg-black/40 backdrop-blur-xl">
                {showHint && !loading && (
                    <div className="mb-3 text-center animate-bounce-in">
                        <span className="bg-yellow-900/80 text-yellow-300 text-xs px-4 py-2 rounded-full border border-yellow-500/30 inline-block shadow-lg backdrop-blur-sm font-bold">
                            💡 Hint: 何も思いつかない？ "How about you?" と聞いてみよう！
                        </span>
                    </div>
                )}

                {/* ★修正: items-end でボタンと入力欄の下端を揃える */}
                <form onSubmit={handleSend} className="flex gap-3 relative items-end max-w-4xl mx-auto">
                    {/* ★修正: textareaに変更 */}
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type here..."
                        className="flex-1 bg-white/10 border border-white/10 text-white p-4 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all resize-none placeholder-gray-500 backdrop-blur-sm"
                        rows={1}
                        style={{ minHeight: '56px', maxHeight: '150px' }}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!input || loading}
                        className="bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white p-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/30 h-[56px] flex items-center justify-center w-[56px]"
                    >
                        <Send size={24} />
                    </button>

                    {startTime && (
                        <div className="absolute -top-10 right-0 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full font-mono flex items-center gap-2 backdrop-blur-md border border-white/10 shadow-lg">
                            <Clock size={12} className="text-blue-400" /> <span className="font-bold text-blue-200">{((Date.now() - startTime) / 1000).toFixed(1)}s</span>
                        </div>
                    )}
                </form>
            </div>
        </main>
    );
}


