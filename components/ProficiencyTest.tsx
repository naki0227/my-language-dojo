'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Question = {
    id: number;
    category: string;
    question: string;
    options: string[];
    answer_index: number;
};

type Props = {
    userId: string;
    onClose: () => void;
};

export default function ProficiencyTest({ userId, onClose }: Props) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(600); // 10分 (600秒)
    const [isStarted, setIsStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);
    const [newLevel, setNewLevel] = useState('');

    // 問題を取得 (ランダムに20問)
    useEffect(() => {
        const fetchQuestions = async () => {
            // 注意: 本来はRPC(Stored Procedure)でランダム取得するのが高速ですが、
            // 簡易的にクライアントでシャッフルします。
            const { data } = await supabase.from('proficiency_questions').select('*');
            if (data) {
                const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 20);
                setQuestions(shuffled);
            }
        };
        fetchQuestions();
    }, []);

    // タイマー
    useEffect(() => {
        if (!isStarted || isFinished) return;
        if (timeLeft <= 0) {
            finishTest();
            return;
        }
        const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStarted, isFinished, timeLeft]);

    const handleAnswer = (choiceIndex: number) => {
        const newAnswers = [...answers];
        newAnswers[currentIdx] = choiceIndex;
        setAnswers(newAnswers);

        if (currentIdx < questions.length - 1) {
            setCurrentIdx(currentIdx + 1);
        } else {
            finishTest(newAnswers);
        }
    };

    const finishTest = async (finalAnswers = answers) => {
        setIsFinished(true);

        // 採点
        let rawScore = 0;
        questions.forEach((q, i) => {
            if (finalAnswers[i] === q.answer_index) rawScore++;
        });

        // 100点満点に換算
        const finalScore = Math.round((rawScore / questions.length) * 100);
        setScore(finalScore);

        // レベル判定
        let level = 'A1 (Beginner)';
        if (finalScore >= 90) level = 'C2 (Master)';
        else if (finalScore >= 80) level = 'C1 (Advanced)';
        else if (finalScore >= 60) level = 'B2 (Upper Intermediate)';
        else if (finalScore >= 40) level = 'B1 (Intermediate)';
        else if (finalScore >= 20) level = 'A2 (Elementary)';

        setNewLevel(level);

        // 結果保存
        await supabase.from('test_results').insert([{
            user_id: userId,
            score: finalScore,
            level_result: level
        }]);

        // 実績解除チェック (クイズ王)
        if (finalScore >= 90) {
            const { data: ach } = await supabase.from('achievements').select('id').eq('id', 'quiz_master').single();
            if (ach) {
                await supabase.from('user_achievements').upsert(
                    { user_id: userId, achievement_id: ach.id },
                    { onConflict: 'user_id, achievement_id' }
                );
            }
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    if (!isStarted) {
        return (
            <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full p-8 rounded-2xl text-center animate-bounce-in">
                    <h1 className="text-3xl font-black text-blue-600 mb-4">🔥 実力診断テスト</h1>
                    <p className="text-gray-600 mb-6">
                        全{questions.length}問 / 制限時間10分<br />
                        あなたの英語力を測定し、レベルを更新します。<br />
                        <span className="text-xs text-gray-400">※一度受けると結果が記録されます</span>
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={onClose} className="text-gray-500 font-bold px-4">あとで</button>
                        <button onClick={() => setIsStarted(true)} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition">
                            スタート！
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isFinished) {
        return (
            <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full p-8 rounded-2xl text-center animate-fade-in">
                    <div className="text-6xl mb-4">🏆</div>
                    <h2 className="text-4xl font-black text-gray-800 mb-2">{score} <span className="text-lg text-gray-400">/ 100</span></h2>
                    <p className="text-xl font-bold text-blue-600 mb-6">New Level: {newLevel}</p>
                    <p className="text-gray-500 text-sm mb-8">結果に基づいておすすめコンテンツが更新されました。</p>
                    <button onClick={onClose} className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold">閉じる</button>
                </div>
            </div>
        );
    }

    const q = questions[currentIdx];

    return (
        <div className="fixed inset-0 bg-gray-100 z-[100] flex flex-col items-center justify-center p-4">
            {/* ヘッダー */}
            <div className="w-full max-w-2xl flex justify-between items-center mb-8">
                <div className="text-xl font-bold text-gray-500">Q{currentIdx + 1} <span className="text-sm text-gray-300">/ {questions.length}</span></div>
                <div className={`text-xl font-mono font-bold ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
                    ⏱ {formatTime(timeLeft)}
                </div>
            </div>

            {/* 問題カード */}
            <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl mb-8">
                <span className="inline-block bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded mb-4 uppercase">{q.category}</span>
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {q.question}
                </h2>
            </div>

            {/* 選択肢 */}
            <div className="w-full max-w-2xl grid gap-3">
                {q.options.map((opt, i) => (
                    <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        className="w-full bg-white border-2 border-gray-200 p-4 rounded-xl text-left font-bold text-gray-700 hover:border-blue-500 hover:bg-blue-50 transition active:scale-95"
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

