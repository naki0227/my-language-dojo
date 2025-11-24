'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Heatmap from '@/components/Heatmap';
import DailyQuiz from '@/components/DailyQuiz'; // 追加

export default function Dashboard() {
    const [userId, setUserId] = useState<string | null>(null);
    const [dailyPick, setDailyPick] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [username, setUsername] = useState('Hero');

    // クイズ用State
    const [showQuiz, setShowQuiz] = useState(false);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
                const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
                if (profile) setUsername(profile.username);

                const { data: hist } = await supabase
                    .from('view_history')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('viewed_at', { ascending: false })
                    .limit(10);
                if (hist) setHistory(hist);
            }

            const today = new Date().toISOString().split('T')[0];
            const { data: pick } = await supabase
                .from('daily_picks')
                .select('*')
                .eq('date', today)
                .single();
            if (pick) setDailyPick(pick);
        };
        init();
    }, []);

    return (
        <main className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
            {/* クイズモーダル */}
            {showQuiz && dailyPick?.quiz_data && (
                <DailyQuiz questions={dailyPick.quiz_data} onClose={() => setShowQuiz(false)} />
            )}

            <div className="w-full max-w-4xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">🏠 Dashboard</h1>
                    <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow">Go to Studio</Link>
                </div>

                {/* 1. 今日のピックアップ */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg mb-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-sm font-bold uppercase opacity-80 mb-2">📅 Today's Pick</h2>
                            {dailyPick ? (
                                <div>
                                    <p className="text-2xl font-bold mb-4">{dailyPick.message}</p>
                                    <div className="flex gap-3 flex-wrap">
                                        {dailyPick.video_id && (
                                            <Link href={`/?videoId=${dailyPick.video_id}`} className="inline-block bg-white text-purple-600 px-6 py-2 rounded-full font-bold hover:bg-gray-100 transition">
                                                ▶ 動画を見る
                                            </Link>
                                        )}
                                        {/* クイズボタン (クイズデータがある場合のみ表示) */}
                                        {dailyPick.quiz_data && dailyPick.quiz_data.length > 0 && (
                                            <button
                                                onClick={() => setShowQuiz(true)}
                                                className="inline-block bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-bold hover:bg-yellow-300 transition shadow-md"
                                            >
                                                🧩 今日のクイズに挑戦！
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p>今日のピックアップはまだありません。更新をお待ちください！</p>
                            )}
                        </div>
                        <div className="text-6xl opacity-20">🎁</div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* 2. ヒートマップ */}
                    <div>
                        <h3 className="font-bold text-gray-700 mb-4">🔥 Consistency</h3>
                        {userId && <Heatmap userId={userId} />}
                    </div>

                    {/* 3. 閲覧履歴 */}
                    <div>
                        <h3 className="font-bold text-gray-700 mb-4">🕰 Recent History</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {history.length === 0 ? (
                                <div className="p-4 text-gray-400 text-sm">履歴はありません</div>
                            ) : (
                                history.map((item) => (
                                    <Link
                                        key={item.id}
                                        href={item.content_type === 'video' ? `/?videoId=${item.target_id}` : `/textbook/${item.target_id}`}
                                        className="block p-3 border-b border-gray-100 hover:bg-gray-50 transition flex justify-between items-center"
                                    >
                                        <span className="text-sm text-gray-700 truncate flex-1">
                                            {item.content_type === 'video' ? '🎥' : '📖'} {item.title || 'No Title'}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(item.viewed_at).toLocaleDateString()}
                                        </span>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}


