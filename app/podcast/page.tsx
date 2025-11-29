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
        <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-sans p-6 relative">
            <div className="w-full max-w-md z-10">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Headphones className="text-pink-500" /> AI Podcast</h1>
                    <Link href="/" className="text-gray-500 text-sm">Exit</Link>
                </div>

                {/* Source Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {(['all', 'textbook', 'vocab', 'reading'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setSource(s)}
                            className={`px-4 py-1 rounded-full text-sm font-bold capitalize whitespace-nowrap transition ${source === s ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            {s}
                        </button>
                    ))}
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

                    <div className="flex justify-between w-full px-4">
                        <div className="flex gap-4 text-sm font-bold text-gray-500">
                            <button onClick={() => setRate(0.8)} className={rate === 0.8 ? 'text-pink-500' : ''}>0.8x</button>
                            <button onClick={() => setRate(1.0)} className={rate === 1.0 ? 'text-pink-500' : ''}>1.0x</button>
                            <button onClick={() => setRate(1.5)} className={rate === 1.5 ? 'text-pink-500' : ''}>1.5x</button>
                        </div>
                        <button onClick={() => setShowScript(!showScript)} className="text-sm font-bold text-indigo-400 flex items-center gap-1">
                            <BookOpen size={16} /> {showScript ? 'Hide Script' : 'Show Script'}
                        </button>
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

            {/* Script Overlay */}
            {showScript && (
                <div className="absolute inset-0 bg-gray-900/95 z-20 p-6 overflow-y-auto animate-fade-in">
                    <div className="max-w-md mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Script</h3>
                            <button onClick={() => setShowScript(false)} className="text-gray-400 hover:text-white">Close</button>
                        </div>
                        <div className="space-y-4 text-lg leading-relaxed">
                            {playlist[currentIndex]?.segments.map((seg, i) => (
                                <div key={i} className={`p-2 rounded ${i === currentSegmentIndex ? 'bg-indigo-900/50 border-l-4 border-indigo-500' : ''}`}>
                                    <span className="text-xs font-bold text-gray-500 block mb-1">{seg.speaker === 'System' ? '🇯🇵' : seg.speaker === 'A' ? 'Host A' : 'Host B'}</span>
                                    <p className={seg.lang === 'ja-JP' ? 'text-gray-300' : 'text-white'}>{seg.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
