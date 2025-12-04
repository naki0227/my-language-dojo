'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Play, Pause, SkipForward, SkipBack, Headphones, BookOpen, List } from 'lucide-react';

type Segment = {
    text: string;
    lang: string;
    speaker?: 'A' | 'B' | 'System';
};

type PlaylistItem = {
    id: string;
    title: string;
    segments: Segment[];
    type: 'vocab' | 'textbook' | 'reading';
};

const SUBJECT_TO_BCP47: Record<string, string> = {
    'English': 'en-US',
    'Japanese': 'ja-JP',
    'Spanish': 'es-ES',
    'French': 'fr-FR',
    'Chinese': 'zh-CN',
    'Korean': 'ko-KR',
    'Portuguese': 'pt-BR',
    'Arabic': 'ar-SA',
    'Russian': 'ru-RU',
    'German': 'de-DE',
    'Italian': 'it-IT',
    'Indonesian': 'id-ID'
};

// Japanese character detection regex
const JA_REGEX = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;

export default function PodcastPage() {
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [rate, setRate] = useState(0.8); // Default 0.8x for clarity
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    // New Features
    const [source, setSource] = useState<'all' | 'textbook' | 'vocab' | 'reading'>('all');
    const [showScript, setShowScript] = useState(false);

    // Load voices
    useEffect(() => {
        const loadVoices = () => {
            setVoices(window.speechSynthesis.getVoices());
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    // Helper to parse content into segments
    const parseContent = (text: string, baseLang: string, type: 'vocab' | 'textbook' | 'reading'): Segment[] => {
        const segments: Segment[] = [];

        if (type === 'vocab') {
            // Format: "Word. Meaning"
            // We assume the first part is target lang, second is Japanese (if present)
            // But actually the input text is "Word. Translation"
            // Let's split by period or just detect Japanese
            const parts = text.split('.');
            parts.forEach(part => {
                const trimmed = part.trim();
                if (!trimmed) return;
                if (JA_REGEX.test(trimmed)) {
                    segments.push({ text: trimmed, lang: 'ja-JP', speaker: 'System' });
                } else {
                    segments.push({ text: trimmed, lang: baseLang, speaker: 'A' });
                }
            });
        } else {
            // Textbook / Podcast / Reading
            // Split by lines to handle dialogue better
            const lines = text.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                // Detect Speaker
                let speaker: 'A' | 'B' | 'System' = 'A';
                if (trimmed.startsWith('Host A:') || trimmed.startsWith('A:')) speaker = 'A';
                else if (trimmed.startsWith('Host B:') || trimmed.startsWith('B:')) speaker = 'B';
                else if (JA_REGEX.test(trimmed)) speaker = 'System'; // Japanese explanation usually system

                // Detect Language
                // If the line contains SIGNIFICANT Japanese, treat as Japanese.
                // But sometimes mixed. Ideally we split mixed lines too, but for now line-level is safer.
                const isJapanese = JA_REGEX.test(trimmed);

                // Clean up prefixes for reading AND remove asterisks
                const cleanText = trimmed
                    .replace(/^(Host [AB]:|A:|B:)/i, '') // Remove speaker prefix
                    .replace(/\*/g, '')                  // Remove asterisks
                    .trim();

                if (!cleanText) return; // Skip if empty after cleaning

                segments.push({
                    text: cleanText,
                    lang: isJapanese ? 'ja-JP' : baseLang,
                    speaker: isJapanese ? 'System' : speaker
                });
            });
        }
        return segments;
    };

    // Initial Load & Source Change
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const items: PlaylistItem[] = [];

            // 1. Vocab
            if (source === 'all' || source === 'vocab') {
                const { data: vocab } = await supabase.from('vocab').select('word, translation, subject').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20);
                vocab?.forEach((v, i) => {
                    const lang = SUBJECT_TO_BCP47[v.subject || 'English'] || 'en-US';
                    items.push({
                        id: `v-${i}`,
                        title: `Word: ${v.word}`,
                        segments: parseContent(`${v.word}. ${v.translation}`, lang, 'vocab'),
                        type: 'vocab'
                    });
                });
            }

            // 2. Textbooks
            if (source === 'all' || source === 'textbook') {
                const { data: books } = await supabase.from('textbooks').select('title, content, subject').limit(5);
                books?.forEach((b, i) => {
                    const lang = SUBJECT_TO_BCP47[b.subject] || 'en-US';
                    items.push({
                        id: `b-${i}`,
                        title: b.title,
                        segments: parseContent(b.content, lang, 'textbook'),
                        type: 'textbook'
                    });
                });
            }

            // 3. Readings
            if (source === 'all' || source === 'reading') {
                const { data: readings } = await supabase.from('readings').select('title, content, subject').limit(5);
                readings?.forEach((r, i) => {
                    const lang = SUBJECT_TO_BCP47[r.subject] || 'en-US';
                    items.push({
                        id: `r-${i}`,
                        title: r.title,
                        segments: parseContent(r.content, lang, 'reading'),
                        type: 'reading'
                    });
                });
            }

            // Shuffle mixed content if 'all' (optional, but good for variety)
            // For now, just set playlist.
            setPlaylist(items);
            setCurrentIndex(0);
            setCurrentSegmentIndex(0);
            setIsPlaying(false);
        };
        init();
    }, [source]);

    // Playback Logic
    useEffect(() => {
        if (!isPlaying || !playlist[currentIndex]) return;

        const item = playlist[currentIndex];
        const segment = item.segments[currentSegmentIndex];

        if (!segment) {
            // End of item
            if (currentIndex < playlist.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setCurrentSegmentIndex(0);
            } else {
                setIsPlaying(false);
            }
            return;
        }

        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = segment.lang;
        utterance.rate = rate;

        // Voice Selection
        if (voices.length > 0) {
            // Filter voices by lang
            const langVoices = voices.filter(v => v.lang.startsWith(segment.lang.split('-')[0])); // Match 'en' from 'en-US'

            if (langVoices.length > 0) {
                if (segment.lang === 'ja-JP') {
                    utterance.voice = langVoices[0]; // Default Japanese
                } else {
                    // Try to assign different voices for A and B
                    if (segment.speaker === 'A') utterance.voice = langVoices[0];
                    else if (segment.speaker === 'B') utterance.voice = langVoices[1] || langVoices[0]; // Fallback to 0 if only 1 voice
                    else utterance.voice = langVoices[0];
                }
            }
        }

        utterance.onend = () => {
            setCurrentSegmentIndex(prev => prev + 1);
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

        return () => {
            window.speechSynthesis.cancel();
        };
    }, [currentIndex, currentSegmentIndex, isPlaying, rate, playlist, voices]);

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
        if (direction === 'next' && currentIndex < playlist.length - 1) {
            setCurrentIndex(c => c + 1);
            setCurrentSegmentIndex(0);
        }
        if (direction === 'prev' && currentIndex > 0) {
            setCurrentIndex(c => c - 1);
            setCurrentSegmentIndex(0);
        }
        setIsPlaying(true);
    };

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-md z-10 relative">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800"><Headphones className="text-indigo-600" /> Vidnitive Podcast</h1>
                    <Link href="/" className="text-gray-500 text-sm hover:text-indigo-600 transition font-bold">Exit</Link>
                </div>

                {/* Source Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide justify-center">
                    {(['all', 'textbook', 'vocab', 'reading'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setSource(s)}
                            className={`px-5 py-2 rounded-full text-sm font-bold capitalize whitespace-nowrap transition shadow-sm ${source === s ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-white/80 text-gray-600 hover:bg-white'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {/* アートワーク風表示 */}
                <div className="aspect-square glass-card border-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl mb-8 flex items-center justify-center relative overflow-hidden group">
                    <div className="text-center p-8 text-white z-10">
                        <div className="text-7xl mb-6 transform group-hover:scale-110 transition duration-500">🎧</div>
                        <h2 className="text-2xl font-bold mb-3 line-clamp-2 leading-tight">{playlist[currentIndex]?.title || 'Loading...'}</h2>
                        <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                            {playlist[currentIndex]?.type || 'System'}
                        </span>
                    </div>

                    {/* Visualizer effect */}
                    {isPlaying && <div className="absolute bottom-8 right-8 flex gap-1.5 h-6 items-end">
                        <div className="w-1.5 bg-white/80 animate-pulse h-full rounded-full"></div>
                        <div className="w-1.5 bg-white/80 animate-pulse h-3 rounded-full animation-delay-75"></div>
                        <div className="w-1.5 bg-white/80 animate-pulse h-5 rounded-full animation-delay-150"></div>
                        <div className="w-1.5 bg-white/80 animate-pulse h-2 rounded-full animation-delay-300"></div>
                    </div>}

                    {/* Background decorations */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                </div>

                {/* コントローラー */}
                <div className="glass-card p-6 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-10">
                        <button onClick={() => skip('prev')} className="text-gray-400 hover:text-indigo-600 transition"><SkipBack size={32} /></button>
                        <button
                            onClick={togglePlay}
                            className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 hover:shadow-2xl transition transform"
                        >
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={() => skip('next')} className="text-gray-400 hover:text-indigo-600 transition"><SkipForward size={32} /></button>
                    </div>

                    <div className="flex justify-between w-full px-2 pt-2 border-t border-gray-100">
                        <div className="flex gap-4 text-sm font-bold text-gray-400">
                            <button onClick={() => setRate(0.8)} className={`transition ${rate === 0.8 ? 'text-indigo-600' : 'hover:text-gray-600'}`}>0.8x</button>
                            <button onClick={() => setRate(1.0)} className={`transition ${rate === 1.0 ? 'text-indigo-600' : 'hover:text-gray-600'}`}>1.0x</button>
                            <button onClick={() => setRate(1.5)} className={`transition ${rate === 1.5 ? 'text-indigo-600' : 'hover:text-gray-600'}`}>1.5x</button>
                        </div>
                        <button onClick={() => setShowScript(!showScript)} className="text-sm font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition">
                            <BookOpen size={16} /> {showScript ? 'Hide Script' : 'Show Script'}
                        </button>
                    </div>
                </div>

                {/* プレイリスト (簡易) */}
                <div className="mt-8">
                    <p className="text-xs text-gray-400 mb-3 font-bold uppercase tracking-widest pl-2">Up Next</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {playlist.map((item, i) => (
                            <div key={i} onClick={() => { setCurrentIndex(i); setIsPlaying(true); }} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${currentIndex === i ? 'bg-white shadow-sm border border-indigo-100' : 'hover:bg-white/50 text-gray-500'}`}>
                                <span className={`text-xs font-mono w-5 text-center ${currentIndex === i ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>{i + 1}</span>
                                <p className={`text-sm truncate ${currentIndex === i ? 'font-bold text-gray-800' : ''}`}>{item.title}</p>
                                {currentIndex === i && <div className="ml-auto w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Script Overlay */}
            {showScript && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-xl z-50 p-6 overflow-y-auto animate-fade-in flex flex-col">
                    <div className="max-w-md mx-auto w-full flex-1">
                        <div className="flex justify-between items-center mb-8 sticky top-0 bg-white/95 backdrop-blur-xl py-4 border-b border-gray-100">
                            <h3 className="text-2xl font-bold text-gray-800">Transcript</h3>
                            <button onClick={() => setShowScript(false)} className="text-gray-400 hover:text-gray-800 font-bold">Close</button>
                        </div>
                        <div className="space-y-6 pb-20">
                            {playlist[currentIndex]?.segments.map((seg, i) => (
                                <div key={i} className={`p-4 rounded-2xl transition duration-500 ${i === currentSegmentIndex ? 'bg-indigo-50 border border-indigo-100 shadow-sm scale-105' : 'opacity-70'}`}>
                                    <span className="text-xs font-bold text-indigo-400 block mb-2 uppercase tracking-wider">{seg.speaker === 'System' ? '🇯🇵 System' : seg.speaker === 'A' ? 'Host A' : 'Host B'}</span>
                                    <p className={`text-lg leading-relaxed ${seg.lang === 'ja-JP' ? 'text-gray-500 font-medium' : 'text-gray-800'}`}>{seg.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
