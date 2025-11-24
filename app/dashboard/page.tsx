'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Heatmap from '@/components/Heatmap';
import StudyStats from '@/components/StudyStats';
import Achievements from '@/components/Achievements';
import DailyQuiz from '@/components/DailyQuiz';
import ProficiencyTest from '@/components/ProficiencyTest';
import LearningRoadmap from '@/components/LearningRoadmap'; // ★追加

export default function Dashboard() {
    const [userId, setUserId] = useState<string | null>(null);
    const [dailyPick, setDailyPick] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [username, setUsername] = useState('Hero');
    const [showQuiz, setShowQuiz] = useState(false);

    const [showProficiencyTest, setShowProficiencyTest] = useState(false);
    const [testResults, setTestResults] = useState<any[]>([]);
    const [currentLevel, setCurrentLevel] = useState('未測定');

    const fetchDashboardData = useCallback(async (uid: string) => {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', uid).single();
        if (profile) setUsername(profile.username);

        const { data: hist } = await supabase.from('view_history').select('*').eq('user_id', uid).order('viewed_at', { ascending: false }).limit(5);
        if (hist) setHistory(hist);

        const { data: tests } = await supabase
            .from('test_results')
            .select('*')
            .eq('user_id', uid)
            .order('taken_at', { ascending: false });

        if (tests && tests.length > 0) {
            setTestResults(tests);
            setCurrentLevel(tests[0].level_result);
        } else {
            setCurrentLevel('未測定');
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
                await fetchDashboardData(session.user.id);
            }

            const today = new Date().toISOString().split('T')[0];
            const { data: pick } = await supabase.from('daily_picks').select('*').eq('date', today).single();
            if (pick) setDailyPick(pick);
        };
        init();
    }, [fetchDashboardData]);

    const getRecommendation = () => {
        if (currentLevel.includes('A')) return "まずは「中学英語」の教科書と、日常会話の動画から始めましょう。";
        if (currentLevel.includes('B')) return "「高校英語」の復習と、少し長めのTED動画に挑戦してみましょう。";
        if (currentLevel.includes('C')) return "ビジネス英語や、英検1級レベルのコンテンツで教養を深めましょう。";
        return "まずは実力診断テストを受けて、レベルを測定しましょう！";
    };

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
            {showQuiz && dailyPick?.quiz_data && <DailyQuiz questions={dailyPick.quiz_data} onClose={() => setShowQuiz(false)} />}

            {showProficiencyTest && userId && (
                <ProficiencyTest
                    userId={userId}
                    onClose={async () => {
                        setShowProficiencyTest(false);
                        await fetchDashboardData(userId);
                    }}
                />
            )}

            <div className="w-full max-w-5xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">🏠 Dashboard</h1>
                    <Link href="/" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300">← Studio</Link>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* 左カラム: メイン情報 */}
                    <div className="md:col-span-2 space-y-6">

                        {/* 1. 今日のピックアップ */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-xs font-bold uppercase opacity-70 mb-1">📅 Today's Pick</h2>
                                {dailyPick ? (
                                    <>
                                        <p className="text-2xl font-bold mb-4">{dailyPick.message}</p>
                                        <div className="flex gap-3">
                                            {dailyPick.video_id && <Link href={`/?videoId=${dailyPick.video_id}`} className="bg-white text-purple-600 px-5 py-2 rounded-full font-bold hover:bg-gray-100">▶ Watch</Link>}
                                            {dailyPick.quiz_data && <button onClick={() => setShowQuiz(true)} className="bg-yellow-400 text-yellow-900 px-5 py-2 rounded-full font-bold hover:bg-yellow-300">🧩 Quiz</button>}
                                        </div>
                                    </>
                                ) : <p>本日のコンテンツは準備中です。</p>}
                            </div>
                            <div className="absolute right-[-20px] bottom-[-20px] text-9xl opacity-10">🎁</div>
                        </div>

                        {/* 2. 学習統計 */}
                        {userId && <StudyStats userId={userId} />}

                        {/* 3. レベル & おすすめ */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700">🚀 Your Level & Plan</h3>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${currentLevel === '未測定' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                                    {currentLevel}
                                </span>
                            </div>
                            <p className="text-gray-600 mb-4">{getRecommendation()}</p>
                            <button
                                onClick={() => setShowProficiencyTest(true)}
                                className="w-full border-2 border-blue-500 text-blue-600 py-2 rounded-lg font-bold hover:bg-blue-50 transition"
                            >
                                {testResults.length > 0 ? '実力テストを再受験する' : '実力診断テストを受ける'}
                            </button>
                        </div>

                        {/* 4. ★ロードマップ (ここに追加)★ */}
                        {userId && currentLevel !== '未測定' && (
                            <LearningRoadmap levelResult={currentLevel} userId={userId} />
                        )}

                    </div>

                    {/* 右カラム: 実績・履歴 */}
                    <div className="space-y-6">
                        {userId && <Achievements userId={userId} />}

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700">🕰 History</h3>
                                <Link href="/dashboard/archive" className="text-xs text-blue-500 hover:underline">Archives</Link>
                            </div>
                            <div className="space-y-3">
                                {history.map((item) => (
                                    <Link key={item.id} href={item.content_type === 'video' ? `/?videoId=${item.target_id}` : `/textbook/${item.target_id}`} className="block">
                                        <div className="text-sm text-gray-800 truncate hover:text-blue-600 transition">{item.title || 'No Title'}</div>
                                        <div className="text-xs text-gray-400">{new Date(item.viewed_at).toLocaleDateString()}</div>
                                    </Link>
                                ))}
                                {history.length === 0 && <p className="text-gray-400 text-sm">履歴なし</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}


