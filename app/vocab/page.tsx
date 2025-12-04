'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Vocab = {
    id: number;
    word: string;
    translation: string;
    created_at: string;
    next_review_at: string;
    interval: number;
    streak: number;
    subject: string;
};

const SUBJECTS = ['English', 'Spanish', 'French', 'Chinese', 'Korean', 'Portuguese', 'Arabic', 'Russian', 'Indonesian', 'Programming', 'Sign Language'];

export default function VocabPage() {
    const router = useRouter();
    const [vocabList, setVocabList] = useState<Vocab[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'review'>('review');
    const [currentSubject, setCurrentSubject] = useState('English');
    const [userId, setUserId] = useState<string | null>(null);

    // 復習モード用
    const [reviewQueue, setReviewQueue] = useState<Vocab[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewFinished, setReviewFinished] = useState(false);

    // データ取得
    const fetchVocab = useCallback(async (uid: string, subject: string) => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('vocab')
            .select('*')
            .eq('user_id', uid)
            .eq('subject', subject) // ★フィルタリング
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
        } else {
            const allVocab = data as Vocab[] || [];
            setVocabList(allVocab);

            const now = new Date();
            const due = allVocab.filter(v => new Date(v.next_review_at) <= now);
            setReviewQueue(due);

            // リセット
            setCurrentCardIndex(0);
            setReviewFinished(false);
            setIsFlipped(false);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }
            setUserId(session.user.id);

            // プロフィールの設定をデフォルトにする
            const { data: profile } = await supabase.from('profiles').select('learning_target').eq('id', session.user.id).single();
            const initialSubject = profile?.learning_target || 'English';
            setCurrentSubject(initialSubject);

            fetchVocab(session.user.id, initialSubject);
        };
        init();
    }, [router, fetchVocab]);

    const handleSubjectChange = (newSubject: string) => {
        setCurrentSubject(newSubject);
        if (userId) fetchVocab(userId, newSubject);
    };

    // --- 復習ロジック ---
    const handleReview = async (quality: 'forgot' | 'remembered') => {
        const currentCard = reviewQueue[currentCardIndex];
        if (!currentCard) return;

        let newInterval = 1;
        let newStreak = 0;

        if (quality === 'remembered') {
            newStreak = currentCard.streak + 1;
            if (newStreak === 1) newInterval = 1;
            else if (newStreak === 2) newInterval = 3;
            else newInterval = Math.ceil(currentCard.interval * 1.5);
        } else {
            newStreak = 0;
            newInterval = 1;
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);

        const nextIndex = currentCardIndex + 1;
        if (nextIndex >= reviewQueue.length) {
            setReviewFinished(true);
        } else {
            setCurrentCardIndex(nextIndex);
            setIsFlipped(false);
        }

        await supabase.from('vocab').update({
            next_review_at: nextDate.toISOString(),
            interval: newInterval,
            streak: newStreak
        }).eq('id', currentCard.id);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('削除しますか？')) return;
        await supabase.from('vocab').delete().eq('id', id);
        setVocabList(vocabList.filter(v => v.id !== id));
    };

    const currentCard = reviewQueue[currentCardIndex];

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="w-full max-w-3xl relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3 tracking-tight">
                        <span className="text-4xl">📚</span> {currentSubject} Vidnitive Wordbook
                    </h1>

                    <div className="flex items-center gap-4">
                        {/* ★言語切り替えセレクター */}
                        <select
                            value={currentSubject}
                            onChange={(e) => handleSubjectChange(e.target.value)}
                            className="glass px-4 py-2 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-500"
                        >
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Link href="/" className="glass px-6 py-2 rounded-xl font-bold text-green-600 hover:bg-white/50 transition">← Studio</Link>
                    </div>
                </div>

                {/* タブ切り替え */}
                <div className="w-full flex glass-card p-1 mb-8">
                    <button onClick={() => setActiveTab('review')} className={`flex-1 py-3 rounded-lg font-bold transition-all ${activeTab === 'review' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md' : 'text-gray-500 hover:bg-white/50'}`}>
                        🔥 Review ({reviewQueue.length})
                    </button>
                    <button onClick={() => setActiveTab('list')} className={`flex-1 py-3 rounded-lg font-bold transition-all ${activeTab === 'list' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md' : 'text-gray-500 hover:bg-white/50'}`}>
                        📋 List ({vocabList.length})
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-20 glass-card">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                        <p className="text-gray-500 font-medium">Loading words...</p>
                    </div>
                ) : activeTab === 'review' ? (
                    <div className="w-full">
                        {reviewFinished || reviewQueue.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <div className="text-7xl mb-6 animate-bounce">🎉</div>
                                <h2 className="text-3xl font-bold text-gray-800 mb-3">All Caught Up!</h2>
                                <p className="text-gray-500 text-lg mb-8">You've finished your reviews for now.</p>
                                <button onClick={() => setActiveTab('list')} className="text-blue-600 font-bold hover:text-blue-800 transition">View All Words →</button>
                            </div>
                        ) : currentCard ? (
                            <div className="glass-card overflow-hidden min-h-[450px] flex flex-col relative border-0 shadow-2xl">
                                <div className="h-2 bg-gray-100/50 w-full">
                                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-300" style={{ width: `${((currentCardIndex) / reviewQueue.length) * 100}%` }} />
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center relative">
                                    <p className="text-xs text-gray-400 font-bold mb-6 uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full">Review Card</p>
                                    <h2 className="text-5xl md:text-6xl font-black text-gray-800 mb-8 tracking-tight">{currentCard.word}</h2>

                                    {isFlipped ? (
                                        <div className="animate-fade-in w-full">
                                            <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 mb-4">
                                                <p className="text-3xl text-green-700 font-bold">{currentCard.translation}</p>
                                            </div>
                                            <p className="text-gray-400 text-sm font-medium">Streak: {currentCard.streak} 🔥</p>
                                        </div>
                                    ) : (
                                        <button onClick={() => setIsFlipped(true)} className="text-gray-400 hover:text-green-600 border-b-2 border-dashed border-gray-300 hover:border-green-400 pb-1 transition-all font-medium">Tap to flip</button>
                                    )}
                                </div>
                                <div className="p-6 bg-white/40 border-t border-white/20 backdrop-blur-sm">
                                    {!isFlipped ? (
                                        <button onClick={() => setIsFlipped(true)} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">Show Answer</button>
                                    ) : (
                                        <div className="flex gap-4">
                                            <button onClick={() => handleReview('forgot')} className="flex-1 bg-red-100 text-red-600 py-4 rounded-xl font-bold hover:bg-red-200 transition shadow-sm">😭 Forgot</button>
                                            <button onClick={() => handleReview('remembered')} className="flex-1 bg-green-100 text-green-700 py-4 rounded-xl font-bold hover:bg-green-200 transition shadow-sm">😎 Remembered</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="w-full glass-card overflow-hidden">
                        {vocabList.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <p className="text-xl font-bold mb-2">No words yet</p>
                                <p>Watch videos to add new vocabulary!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {vocabList.map((item) => (
                                    <div key={item.id} className="p-5 flex justify-between items-center hover:bg-white/40 transition group">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition">{item.word}</h3>
                                            <p className="text-gray-600 font-medium">{item.translation}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold">Next: {new Date(item.next_review_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition">🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}


