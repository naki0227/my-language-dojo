'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Minimize2, Maximize2, PlayCircle, BookOpen } from 'lucide-react';
import Link from 'next/link';

type Message = {
    role: 'user' | 'ai';
    text: string;
    videos?: { id: string; title: string; thumbnail: string }[];
    drills?: { id: number; title: string; category: string }[]; // ★追加: ドリル提案用
};

export default function AIChatButton({ userId }: { userId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: 'こんにちは！Dojo Masterです。学習の相談や、おすすめの動画・ドリルを聞いてください！' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.text, userId }),
            });

            const data = await res.json();

            const aiMsg: Message = {
                role: 'ai',
                text: data.reply,
                videos: data.videos, // 動画提案
                drills: data.drills  // ★ドリル提案
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: 'すみません、エラーが発生しました。' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // 動画再生ページへ遷移 (またはロード)
    const handleVideoSelect = (videoId: string) => {
        // 現在のページがトップページならリロードなしで切り替えたいが、
        // 汎用性を考えてリンク遷移にする
        window.location.href = `/?videoId=${videoId}`;
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 flex items-center gap-2 animate-bounce-in"
            >
                <MessageCircle size={28} />
                <span className="font-bold hidden md:inline">AI Chat</span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-gray-200 overflow-hidden transition-all duration-300 ${isMinimized ? 'w-72 h-16' : 'w-[90vw] md:w-96 h-[600px] max-h-[80vh]'}`}>
            {/* ヘッダー */}
            <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shrink-0 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
                <div className="flex items-center gap-2 font-bold">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    AI Dojo Master
                </div>
                <div className="flex gap-3">
                    {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}><X size={20} /></button>
                </div>
            </div>

            {/* チャットエリア (最小化時は非表示) */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`p-3 rounded-2xl text-sm max-w-[85%] leading-relaxed shadow-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                                    {m.text}
                                </div>

                                {/* 動画の提案 */}
                                {m.videos && m.videos.length > 0 && (
                                    <div className="mt-2 flex gap-2 overflow-x-auto w-full pb-2 scrollbar-hide">
                                        {m.videos.map(v => (
                                            <div key={v.id} onClick={() => handleVideoSelect(v.id)} className="min-w-[140px] bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition flex-shrink-0 group">
                                                <div className="relative aspect-video">
                                                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                        <PlayCircle className="text-white" />
                                                    </div>
                                                </div>
                                                <p className="p-2 text-xs font-bold text-gray-700 line-clamp-2">{v.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ★追加: ドリルの提案 */}
                                {m.drills && m.drills.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-2 w-full">
                                        <p className="text-xs font-bold text-gray-400 ml-1">おすすめドリル:</p>
                                        {m.drills.map(d => (
                                            <Link key={d.id} href={`/drill/exam/${d.id}`} className="block bg-white border border-l-4 border-l-pink-500 border-gray-200 p-3 rounded shadow-sm hover:bg-gray-50 transition flex items-center justify-between group">
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 group-hover:text-pink-600">{d.title}</p>
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{d.category}</span>
                                                </div>
                                                <BookOpen size={16} className="text-gray-300 group-hover:text-pink-500" />
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && <div className="text-xs text-gray-400 ml-2 animate-pulse">Thinking...</div>}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask anything..."
                            className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-black"
                        />
                        <button type="submit" disabled={!input || isLoading} className="bg-indigo-600 text-white p-2 rounded-full disabled:opacity-50 hover:bg-indigo-500 transition">
                            <Send size={18} />
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}


