'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Heatmap from '@/components/Heatmap';
import StudyStats from '@/components/StudyStats';
import Achievements from '@/components/Achievements';
import DailyQuiz from '@/components/DailyQuiz';
import ProficiencyTest from '@/components/ProficiencyTest';
import LearningRoadmap from '@/components/LearningRoadmap';
import { Rocket, LogOut, PlayCircle, Trophy, Target, Flame, Zap } from 'lucide-react';

// 型定義
type UserLevelData = { subject: string; level_result: string; score: number; xp: number; };

export default function Dashboard() {
    const router = useRouter();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    const [userId, setUserId] = useState<string | null>(null);
    const [dailyPick, setDailyPick] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [username, setUsername] = useState('Hero');
    const [showQuiz, setShowQuiz] = useState(false);

    const [showProficiencyTest, setShowProficiencyTest] = useState(false);

    const [allUserLevels, setAllUserLevels] = useState<UserLevelData[]>([]);
    const [currentSubject, setCurrentSubject] = useState('English'); // 現在選択中の言語

    const [isPro, setIsPro] = useState(false);
    const [supporterTier, setSupporterTier] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async (uid: string) => {
        // 1. プロフィール情報と現在の学習言語を取得
        const { data: profile } = await supabase.from('profiles').select('username, learning_target, is_pro, supporter_tier').eq('id', uid).single();
        const subject = profile?.learning_target || 'English';
        setCurrentSubject(subject);
        if (profile) {
            setUsername(profile.username);
            setIsPro(profile.is_pro || false);
            setSupporterTier(profile.supporter_tier || null);
        }

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
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

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

            <div className="w-full max-w-6xl mx-auto relative z-10">
                {/* Header Section with Image */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-8 group h-64">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/90 via-purple-900/60 to-transparent z-10"></div>
                    <img
                        src="/images/dashboard-header.png"
                        alt="Dashboard Header"
                        className="w-full h-full object-cover transform group-hover:scale-105 transition duration-700"
                    />
                    <div className="absolute inset-0 z-20 flex flex-col justify-center px-10">
                        <div className="flex justify-between items-end">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <h1 className="text-5xl font-bold text-white tracking-tight drop-shadow-lg">Welcome back, {username}</h1>
                                    {isPro && (
                                        <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-black px-2 py-1 rounded shadow-lg border border-yellow-300 transform rotate-3">
                                            PRO
                                        </span>
                                    )}
                                    {supporterTier && (
                                        <span className={`text-xs font-black px-2 py-1 rounded shadow-lg border transform -rotate-2
                                            ${supporterTier === 'gold' ? 'bg-yellow-500 text-yellow-50 border-yellow-300' :
                                                supporterTier === 'silver' ? 'bg-gray-400 text-gray-50 border-gray-300' :
                                                    'bg-orange-700 text-orange-100 border-orange-500'}
                                        `}>
                                            {supporterTier.toUpperCase()} SUPPORTER
                                        </span>
                                    )}
                                </div>
                                <p className="text-xl text-indigo-100 font-medium drop-shadow-md">Ready to unlock your potential in {currentSubject} today?</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleLogout} className="glass px-6 py-3 rounded-full font-bold text-white hover:bg-white/20 transition backdrop-blur-md border border-white/30 shadow-lg">
                                    Sign Out
                                </button>
                                <Link href="/" className="bg-white text-indigo-900 px-8 py-3 rounded-full font-bold hover:bg-indigo-50 transition shadow-lg flex items-center gap-2">
                                    <Rocket size={20} /> Go to Studio
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8">

                    <div className="md:col-span-2 space-y-8">

                        {/* 1. 今日のピックアップ */}
                        <div className="rounded-3xl shadow-xl p-8 relative overflow-hidden border border-white/10 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4 opacity-80">
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Today's Pick</span>
                                    <span className="text-xs font-bold uppercase tracking-wider">{currentSubject}</span>
                                </div>
                                {dailyPick ? (
                                    <>
                                        <p className="text-3xl font-bold mb-6 leading-tight">{dailyPick.message}</p>
                                        <div className="flex gap-4">
                                            {dailyPick.video_id && (
                                                <Link href={`/?videoId=${dailyPick.video_id}`} className="bg-white text-indigo-600 px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-gray-50 transition transform hover:-translate-y-0.5">
                                                    ▶ Watch Now
                                                </Link>
                                            )}
                                            {dailyPick.quiz_data && (
                                                <button onClick={() => setShowQuiz(true)} className="bg-yellow-400 text-yellow-900 px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-yellow-300 transition transform hover:-translate-y-0.5">
                                                    🧩 Take Quiz
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : <p className="text-lg opacity-80">本日のコンテンツは準備中です。</p>}
                            </div>
                            {/* Decorative circles */}
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/30 rounded-full blur-2xl"></div>
                        </div>

                        {/* 2. 学習統計グラフ */}
                        {userId && (
                            <div className="glass-card p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <span>📊</span> Learning Activity
                                </h3>
                                <StudyStats userId={userId} />
                            </div>
                        )}

                        {/* 3. レベル & おすすめ */}
                        <div className="glass-card p-8 border-l-4 border-indigo-500">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-1">🚀 {currentSubject} Roadmap</h3>
                                    <p className="text-sm text-gray-500">Your path to mastery</p>
                                </div>
                                <span className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${isTested ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
                                    {currentLevel}
                                </span>
                            </div>
                            <p className="text-gray-600 mb-6 leading-relaxed bg-white/50 p-4 rounded-xl border border-gray-100">
                                {getRecommendation()}
                            </p>
                            <button
                                onClick={() => setShowProficiencyTest(true)}
                                className="w-full bg-indigo-50 text-indigo-600 py-4 rounded-xl font-bold hover:bg-indigo-100 transition border border-indigo-100 flex items-center justify-center gap-2"
                            >
                                {isTested ? `Retake Proficiency Test (${currentSubject})` : `Start Proficiency Test (${currentSubject})`}
                            </button>
                        </div>

                        {/* 4. ロードマップ */}
                        {userId && isTested && (
                            <div className="glass-card p-6">
                                <LearningRoadmap levelResult={currentLevel} userId={userId} currentSubject={currentSubject} />
                            </div>
                        )}

                    </div>

                    {/* 右カラム: サブ情報 */}
                    <div className="space-y-8">

                        {/* 5. 全言語レベル一覧 */}
                        <div className="glass-card p-6">
                            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">🌍 Language Levels</h3>
                            <div className="space-y-3">
                                {allUserLevels.map((lvl) => (
                                    <div key={lvl.subject} className="flex justify-between items-center p-3 rounded-lg hover:bg-white/50 transition">
                                        <span className={`font-bold ${lvl.subject === currentSubject ? 'text-indigo-600' : 'text-gray-700'}`}>{lvl.subject}</span>
                                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${lvl.level_result === 'A1 (Beginner)' ? 'bg-gray-100 text-gray-500' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {lvl.level_result.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 6. 統計と実績 */}
                        {userId && (
                            <div className="glass-card p-6">
                                <Achievements userId={userId} />
                            </div>
                        )}

                        <div className="glass-card p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <span>🕰</span> History
                                </h3>
                                <Link href="/dashboard/archive" className="text-xs font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full transition">
                                    View All
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {history.map((item) => (
                                    <Link key={item.id} href={item.content_type === 'video' ? `/?videoId=${item.target_id}` : `/textbook/view?id=${item.target_id}`} className="block group">
                                        <div className="p-3 rounded-xl hover:bg-white/60 transition border border-transparent hover:border-indigo-100">
                                            <div className="text-sm font-bold text-gray-800 truncate group-hover:text-indigo-600 transition mb-1">{item.title || 'No Title'}</div>
                                            <div className="text-xs text-gray-400">{new Date(item.viewed_at).toLocaleDateString()}</div>
                                        </div>
                                    </Link>
                                ))}
                                {history.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No history yet</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

