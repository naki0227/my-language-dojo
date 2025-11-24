'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Heatmap from '@/components/Heatmap';
import StudyStats from '@/components/StudyStats';
import Achievements from '@/components/Achievements';
import DailyQuiz from '@/components/DailyQuiz';
import ProficiencyTest from '@/components/ProficiencyTest';
import LearningRoadmap from '@/components/LearningRoadmap';

// 型定義
type UserLevelData = { subject: string; level_result: string; score: number; xp: number; };

export default function Dashboard() {
    const [userId, setUserId] = useState<string | null>(null);
    const [dailyPick, setDailyPick] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [username, setUsername] = useState('Hero');
    const [showQuiz, setShowQuiz] = useState(false);

    const [showProficiencyTest, setShowProficiencyTest] = useState(false);

    const [allUserLevels, setAllUserLevels] = useState<UserLevelData[]>([]);
    const [currentSubject, setCurrentSubject] = useState('English'); // 現在選択中の言語

    const fetchDashboardData = useCallback(async (uid: string) => {
        // 1. プロフィール情報と現在の学習言語を取得
        const { data: profile } = await supabase.from('profiles').select('username, learning_target').eq('id', uid).single();
        const subject = profile?.learning_target || 'English';
        setCurrentSubject(subject);
        if (profile) setUsername(profile.username);

        // 2. 履歴
        const { data: hist } = await supabase.from('view_history').select('*').eq('user_id', uid).order('viewed_at', { ascending: false }).limit(5);
        if (hist) setHistory(hist);

        // 3. 全言語のレベルデータを取得
        const { data: levels } = await supabase
            .from('user_levels')
            .select('*')
            .eq('user_id', uid)
            .order('subject', { ascending: true });

        if (levels) {
            setAllUserLevels(levels as UserLevelData[]);
        } else {
            setAllUserLevels([]);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
                await fetchDashboardData(session.user.id);
            }

            // 日替わり取得
            const today = new Date().toISOString().split('T')[0];
            const { data: pick } = await supabase.from('daily_picks').select('*').eq('date', today).single();
            if (pick) setDailyPick(pick);
        };
        init();
    }, [fetchDashboardData]);

    // 現在の言語のレベルデータを抽出
    const currentLevelData = allUserLevels.find(l => l.subject === currentSubject);
    const currentLevel = currentLevelData?.level_result || 'A1 (Beginner)';
    const currentLevelCode = currentLevel.split(' ')[0];
    const isTested = currentLevel !== 'A1 (Beginner)';


    const getRecommendation = () => {
        if (currentLevelCode === 'A1') return "まずは単語を覚えましょう。「中学英語」の教科書からスタートです。";
        if (currentLevelCode === 'A2') return "簡単な文章を読み書きし、長めの会話練習に入りましょう。";
        if (currentLevelCode === 'B1') return "難しい文法に挑戦し、中級動画に挑戦しましょう。";
        if (currentLevelCode === 'B2') return "長文読解と表現力を磨き、ビジネスやアカデミックな内容に進みます。";
        if (currentLevelCode === 'C1' || currentLevelCode === 'C2') return "専門的なコラムや、ネイティブ向けのコンテンツで知識層の英語力を目指します。";
        return `実力診断テストを受けて、あなただけの${currentSubject}学習ロードマップを手に入れましょう！`;
    };


    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
            {showQuiz && dailyPick?.quiz_data && <DailyQuiz questions={dailyPick.quiz_data} onClose={() => setShowQuiz(false)} />}

            {/* ★ProficiencyTestに現在の言語を渡す★ */}
            {showProficiencyTest && userId && (
                <ProficiencyTest
                    userId={userId}
                    currentSubject={currentSubject}
                    onClose={async () => {
                        setShowProficiencyTest(false);
                        if (userId) await fetchDashboardData(userId); // データ再取得
                    }}
                />
            )}

            <div className="w-full max-w-5xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">🏠 My Dashboard</h1>
                    <Link href="/" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300">← Studio</Link>
                </div>

                <div className="grid md:grid-cols-3 gap-6">

                    <div className="md:col-span-2 space-y-6">

                        {/* 1. 今日のピックアップ (表示はそのまま、裏でフィルタ) */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-xs font-bold uppercase opacity-70 mb-1">📅 Today's Pick ({currentSubject})</h2>
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

                        {/* 2. 学習統計グラフ */}
                        {userId && <StudyStats userId={userId} />}

                        {/* 3. レベル & おすすめ (メインカード) */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700 text-lg">🚀 {currentSubject} 学習計画</h3>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${isTested ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
                                    {currentLevel}
                                </span>
                            </div>
                            <p className="text-gray-600 mb-4">{getRecommendation()}</p>
                            <button
                                onClick={() => setShowProficiencyTest(true)}
                                className="w-full border-2 border-blue-500 text-blue-600 py-2 rounded-lg font-bold hover:bg-blue-50 transition"
                            >
                                {isTested ? `実力テストを再受験 (${currentSubject})` : `実力診断テストを受ける (${currentSubject})`}
                            </button>
                        </div>

                        {/* 4. ロードマップ (現在の言語とレベルでフィルタリング) */}
                        {userId && isTested && (
                            <LearningRoadmap levelResult={currentLevel} userId={userId} currentSubject={currentSubject} />
                        )}

                    </div>

                    {/* 右カラム: サブ情報 */}
                    <div className="space-y-6">

                        {/* 5. 全言語レベル一覧 */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase">🌍 All Subject Levels</h3>
                            <div className="space-y-2">
                                {allUserLevels.map((lvl) => (
                                    <div key={lvl.subject} className="flex justify-between items-center text-sm">
                                        <span className={`font-bold ${lvl.subject === currentSubject ? 'text-indigo-600' : 'text-gray-800'}`}>{lvl.subject}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${lvl.level_result === 'A1 (Beginner)' ? 'bg-gray-100 text-gray-500' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {lvl.level_result.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 6. 統計と実績 */}
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

