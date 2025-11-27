'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Play, Pause, SkipForward, SkipBack, Headphones, BookOpen, List } from 'lucide-react';

type PlaylistItem = {
    id: string;
    title: string; // 単語や教科書タイトル
    text: string;  // 読み上げる内容
    type: 'vocab' | 'textbook';
};

export default function PodcastPage() {
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [targetLang, setTargetLang] = useState('en-US');
    const [rate, setRate] = useState(1.0); // 再生速度

    // 初期ロード
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 1. 単語帳から取得
            const { data: vocab } = await supabase.from('vocab').select('word, translation').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20);
            // 2. 教科書から取得
            const { data: books } = await supabase.from('textbooks').select('title, content, subject').limit(3);

            const items: PlaylistItem[] = [];

            // 単語は「単語 -> 意味」の順で読む
            vocab?.forEach((v, i) => {
                items.push({ id: `v-${i}`, title: `Word: ${v.word}`, text: `${v.word}. ${v.translation}`, type: 'vocab' });
            });

            // 教科書は少し長いのでタイトルと冒頭を読む
            books?.forEach((b, i) => {
                items.push({ id: `b-${i}`, title: b.title, text: `Lesson: ${b.title}. ${b.content.substring(0, 200)}`, type: 'textbook' });
                // 言語設定を自動調整 (簡易)
                if (b.subject === 'Spanish') setTargetLang('es-ES');
            });

            setPlaylist(items);
        };
        init();
    }, []);

    // 読み上げ制御
    useEffect(() => {
        if (!isPlaying || !playlist[currentIndex]) return;

        const utterance = new SpeechSynthesisUtterance(playlist[currentIndex].text);
        utterance.lang = targetLang;
        utterance.rate = rate;

        utterance.onend = () => {
            if (currentIndex < playlist.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsPlaying(false); // 終了
            }
        };

        window.speechSynthesis.cancel(); // 前のを止める
        window.speechSynthesis.speak(utterance);

        return () => {
            window.speechSynthesis.cancel();
        };
    }, [currentIndex, isPlaying, rate, targetLang, playlist]);

    const togglePlay = () => {
        if (isPlaying) {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
        } else {
            setIsPlaying(true);
        }
    };

    const skip = (direction: 'next' | 'prev') => {
        window.speechSynthesis.cancel();
        if (direction === 'next' && currentIndex < playlist.length - 1) setCurrentIndex(c => c + 1);
        if (direction === 'prev' && currentIndex > 0) setCurrentIndex(c => c - 1);
        setIsPlaying(true); // スキップしたら再生継続
    };

    return (
        <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-sans p-6">
            <div className="w-full max-w-md">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Headphones className="text-pink-500" /> AI Podcast</h1>
                    <Link href="/" className="text-gray-500 text-sm">Exit</Link>
                </div>

                {/* アートワーク風表示 */}
                <div className="aspect-square bg-gradient-to-br from-pink-500 to-indigo-600 rounded-3xl shadow-2xl mb-8 flex items-center justify-center relative overflow-hidden">
                    <div className="text-center p-6">
                        <div className="text-6xl mb-4">🎧</div>
                        <h2 className="text-2xl font-bold mb-2 line-clamp-2">{playlist[currentIndex]?.title || 'Loading...'}</h2>
                        <span className="bg-black/30 px-3 py-1 rounded-full text-xs font-bold uppercase">
                            {playlist[currentIndex]?.type || 'System'}
                        </span>
                    </div>
                    {isPlaying && <div className="absolute bottom-4 right-4 flex gap-1 h-4 items-end">
                        <div className="w-1 bg-white animate-pulse h-full"></div>
                        <div className="w-1 bg-white animate-pulse h-2"></div>
                        <div className="w-1 bg-white animate-pulse h-3"></div>
                    </div>}
                </div>

                {/* コントローラー */}
                <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-8">
                        <button onClick={() => skip('prev')} className="text-gray-400 hover:text-white"><SkipBack size={32} /></button>
                        <button
                            onClick={togglePlay}
                            className="w-20 h-20 bg-white text-gray-900 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition"
                        >
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={() => skip('next')} className="text-gray-400 hover:text-white"><SkipForward size={32} /></button>
                    </div>

                    <div className="flex gap-4 text-sm font-bold text-gray-500">
                        <button onClick={() => setRate(0.8)} className={rate === 0.8 ? 'text-pink-500' : ''}>0.8x</button>
                        <button onClick={() => setRate(1.0)} className={rate === 1.0 ? 'text-pink-500' : ''}>1.0x</button>
                        <button onClick={() => setRate(1.5)} className={rate === 1.5 ? 'text-pink-500' : ''}>1.5x</button>
                    </div>
                </div>

                {/* プレイリスト (簡易) */}
                <div className="mt-10 border-t border-gray-800 pt-6">
                    <p className="text-xs text-gray-500 mb-4 font-bold uppercase tracking-widest">Up Next</p>
                    <div className="space-y-3 max-h-40 overflow-y-auto">
                        {playlist.map((item, i) => (
                            <div key={i} onClick={() => { setCurrentIndex(i); setIsPlaying(true); }} className={`flex items-center gap-3 p-2 rounded cursor-pointer ${currentIndex === i ? 'bg-gray-800' : 'opacity-50 hover:opacity-100'}`}>
                                <span className="text-xs font-mono text-gray-500 w-4">{i + 1}</span>
                                <p className="text-sm truncate">{item.title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}

