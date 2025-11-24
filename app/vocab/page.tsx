'use client';

import { useEffect, useState } from 'react';
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
};

export default function VocabPage() {
    const router = useRouter();
    const [vocabList, setVocabList] = useState<Vocab[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'review'>('review'); // デフォルトは復習モード

    // 復習モード用のState
    const [reviewQueue, setReviewQueue] = useState<Vocab[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false); // 答えを見たか
    const [reviewFinished, setReviewFinished] = useState(false);

    useEffect(() => {
        fetchVocab();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchVocab = async () => {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push('/auth');
            return;
        }

        const { data, error } = await supabase
            .from('vocab')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            alert('データ取得エラー');
        } else {
            const allVocab = data as Vocab[] || [];
            setVocabList(allVocab);

            // 復習すべき単語を抽出 (今日以前の日付のもの)
            const now = new Date();
            const due = allVocab.filter(v => new Date(v.next_review_at) <= now);
            setReviewQueue(due);
        }
        setIsLoading(false);
    };

    // --- SRSアルゴリズム (Anki風) ---
    const handleReview = async (quality: 'forgot' | 'remembered') => {
        const currentCard = reviewQueue[currentCardIndex];
        if (!currentCard) return;

        let newInterval = 1;
        let newStreak = 0;

        // 次回の復習日を計算
        if (quality === 'remembered') {
            newStreak = currentCard.streak + 1;
            // 間隔を広げる (1日 -> 3日 -> 7日...)
            if (newStreak === 1) newInterval = 1;
            else if (newStreak === 2) newInterval = 3;
            else newInterval = Math.ceil(currentCard.interval * 1.5); // 1.5倍ずつ伸びる
        } else {
            // 忘れていたら1日からやり直し
            newStreak = 0;
            newInterval = 1;
        }

        // 次回の日付
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);

        // 楽観的UI更新 (待たずに次へ)
        const nextIndex = currentCardIndex + 1;
        if (nextIndex >= reviewQueue.length) {
            setReviewFinished(true);
        } else {
            setCurrentCardIndex(nextIndex);
            setIsFlipped(false);
        }

        // DB更新
        await supabase.from('vocab').update({
            next_review_at: nextDate.toISOString(),
            interval: newInterval,
            streak: newStreak
        }).eq('id', currentCard.id);
    };

    // 削除機能
    const handleDelete = async (id: number) => {
        if (!confirm('削除しますか？')) return;
        await supabase.from('vocab').delete().eq('id', id);
        setVocabList(vocabList.filter(v => v.id !== id));
    };

    const currentCard = reviewQueue[currentCardIndex];

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
            {/* ヘッダー */}
            <div className="w-full max-w-2xl flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">My Wordbook</h1>
                <Link href="/" className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">← 戻る</Link>
            </div>

            {/* タブ切り替え */}
            <div className="w-full max-w-2xl flex bg-white rounded-lg shadow-sm p-1 mb-6">
                <button
                    onClick={() => setActiveTab('review')}
                    className={`flex-1 py-2 rounded-md font-bold transition ${activeTab === 'review' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    🔥 復習モード ({reviewQueue.length})
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex-1 py-2 rounded-md font-bold transition ${activeTab === 'list' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    📋 一覧リスト
                </button>
            </div>

            {isLoading ? (
                <p>Loading...</p>
            ) : activeTab === 'review' ? (
                // --- 復習モードの画面 ---
                <div className="w-full max-w-lg">
                    {reviewFinished ? (
                        <div className="bg-white p-10 rounded-2xl shadow-lg text-center animate-bounce-in">
                            <div className="text-6xl mb-4">🎉</div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">今日の復習は完了！</h2>
                            <p className="text-gray-500">また明日戻ってきてね。</p>
                            <button onClick={() => setActiveTab('list')} className="mt-6 text-blue-500 hover:underline">単語リストを見る</button>
                        </div>
                    ) : currentCard ? (
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-[400px] flex flex-col relative border border-gray-100">
                            {/* 進捗バー */}
                            <div className="h-2 bg-gray-100 w-full">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${((currentCardIndex) / reviewQueue.length) * 100}%` }}
                                />
                            </div>

                            {/* カードの中身 */}
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <p className="text-xs text-gray-400 font-bold mb-4 uppercase tracking-widest">Review Card</p>

                                {/* 表面 (英単語) */}
                                <h2 className="text-4xl md:text-5xl font-black text-gray-800 mb-6">{currentCard.word}</h2>

                                {/* 裏面 (答え) - クリックされるまで隠す */}
                                {isFlipped ? (
                                    <div className="animate-fade-in">
                                        <p className="text-2xl text-blue-600 font-bold mb-2">{currentCard.translation}</p>
                                        <p className="text-gray-400 text-sm">連続正解: {currentCard.streak}回</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsFlipped(true)}
                                        className="text-gray-400 hover:text-gray-600 border-b border-dashed border-gray-300 pb-1"
                                    >
                                        タップして答えを表示
                                    </button>
                                )}
                            </div>

                            {/* 操作ボタン */}
                            <div className="p-6 bg-gray-50 border-t border-gray-100">
                                {!isFlipped ? (
                                    <button
                                        onClick={() => setIsFlipped(true)}
                                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-1"
                                    >
                                        答えを見る
                                    </button>
                                ) : (
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleReview('forgot')}
                                            className="flex-1 bg-red-100 text-red-600 py-4 rounded-xl font-bold hover:bg-red-200 transition"
                                        >
                                            😭 忘れた (1日後)
                                        </button>
                                        <button
                                            onClick={() => handleReview('remembered')}
                                            className="flex-1 bg-green-100 text-green-700 py-4 rounded-xl font-bold hover:bg-green-200 transition"
                                        >
                                            😎 覚えた (次に進む)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-10">
                            <p className="text-gray-500">復習する単語はありません。</p>
                            <button onClick={() => setActiveTab('list')} className="mt-4 text-blue-500 hover:underline">一覧を見る</button>
                        </div>
                    )}
                </div>
            ) : (
                // --- リストモードの画面 ---
                <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg overflow-hidden">
                    {vocabList.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">データがありません</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {vocabList.map((item) => (
                                <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{item.word}</h3>
                                        <p className="text-gray-600">{item.translation}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                                                Next: {new Date(item.next_review_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                                Streak: {item.streak}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 px-2">
                                        🗑
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}

