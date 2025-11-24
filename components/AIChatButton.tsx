'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type Video = {
    id: string;
    title: string;
    thumbnail: string;
};

type Message = {
    role: 'user' | 'ai';
    text: string;
    videos?: Video[]; // おすすめ動画リスト
};

type Props = {
    userId: string;
};

export default function AIChatButton({ userId }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: 'こんにちは！レベルに合わせた動画をおすすめしますよ。' }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 自動スクロール
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent, overrideInput?: string) => {
        e?.preventDefault();
        const userMsg = overrideInput || input;
        if (!userMsg.trim()) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, userId }),
            });
            const data = await res.json();

            setMessages(prev => [
                ...prev,
                {
                    role: 'ai',
                    text: data.reply,
                    videos: data.videos // 動画データがあればセット
                }
            ]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: '通信エラーが発生しました。' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <>
            {/* チャットウィンドウ */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[60] flex flex-col overflow-hidden animate-slide-up max-h-[60vh]">
                    {/* ヘッダー */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🤖</span>
                            <div>
                                <h3 className="font-bold text-sm">AI Concierge</h3>
                                <p className="text-[10px] opacity-80">Powered by Gemini 2.5</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white hover:bg-white/20 rounded-full p-1">
                            ▼
                        </button>
                    </div>

                    {/* メッセージエリア */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* テキスト吹き出し */}
                                <div
                                    className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed shadow-sm mb-1
                    ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}
                  `}
                                >
                                    {msg.text}
                                </div>

                                {/* ★動画カード表示エリア (AIからの提案がある場合のみ)★ */}
                                {msg.videos && msg.videos.length > 0 && (
                                    <div className="flex flex-col gap-2 mt-2 w-full max-w-[90%]">
                                        <p className="text-xs text-gray-500 font-bold ml-1">おすすめ動画:</p>
                                        {msg.videos.map((video) => (
                                            <Link
                                                key={video.id}
                                                href={`/?videoId=${video.id}`}
                                                onClick={() => setIsOpen(false)} // クリックしたらチャットを閉じる
                                                className="flex gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 transition group"
                                            >
                                                <img src={video.thumbnail} alt="thumb" className="w-20 h-12 object-cover rounded bg-gray-200 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-gray-800 line-clamp-2 group-hover:text-blue-600">{video.title}</p>
                                                    <p className="text-[10px] text-blue-500 mt-1">▶ 今すぐ再生</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 p-3 rounded-xl rounded-tl-none text-xs text-gray-400 flex items-center gap-1">
                                    <span>Thinking</span>
                                    <span className="animate-bounce">.</span>
                                    <span className="animate-bounce delay-100">.</span>
                                    <span className="animate-bounce delay-200">.</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 入力エリア */}
                    <form onSubmit={(e) => handleSend(e)} className="p-3 bg-white border-t flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="例: 初心者向けの動画は？"
                            className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-black"
                        />
                        <button
                            type="submit"
                            disabled={!input || isTyping}
                            className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:bg-gray-300 transition"
                        >
                            ➤
                        </button>
                    </form>

                    {/* クイックアクション */}
                    <div className="bg-gray-100 p-2 flex gap-2 overflow-x-auto scrollbar-hide">
                        <button onClick={() => handleSend(undefined, 'おすすめの動画を教えて！')} className="whitespace-nowrap text-xs bg-white border px-3 py-1.5 rounded-full text-gray-600 hover:bg-blue-50 font-bold">📺 おすすめ動画</button>
                        <button onClick={() => handleSend(undefined, 'ビジネス英語の動画ある？')} className="whitespace-nowrap text-xs bg-white border px-3 py-1.5 rounded-full text-gray-600 hover:bg-blue-50 font-bold">💼 ビジネス</button>
                        <button onClick={() => handleSend(undefined, '面白いTEDトークは？')} className="whitespace-nowrap text-xs bg-white border px-3 py-1.5 rounded-full text-gray-600 hover:bg-blue-50 font-bold">🎤 TED</button>
                    </div>
                </div>
            )}

            {/* 起動ボタン (FAB) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl hover:scale-110 transition z-50 border-2 border-white"
            >
                {isOpen ? '×' : '🤖'}
            </button>
        </>
    );
}


