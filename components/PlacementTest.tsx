'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
    userId: string;
    onComplete: () => void;
};

const QUESTIONS = [
    { q: "I ___ to the station yesterday.", options: ["go", "went", "gone", "going"], a: 1 },
    { q: "She ___ playing tennis now.", options: ["is", "are", "does", "do"], a: 0 },
    { q: "Have you ever ___ sushi?", options: ["eat", "ate", "eaten", "eating"], a: 2 },
];

export default function PlacementTest({ userId, onComplete }: Props) {
    const [step, setStep] = useState(0);
    const [score, setScore] = useState(0);
    const [finished, setFinished] = useState(false);

    const handleAnswer = (index: number) => {
        if (index === QUESTIONS[step].a) setScore(score + 1);

        if (step < QUESTIONS.length - 1) {
            setStep(step + 1);
        } else {
            finishTest();
        }
    };

    const finishTest = async () => {
        setFinished(true);
        // 結果を保存
        await supabase.from('profiles').update({ placement_test_done: true }).eq('id', userId);
        // スコアに応じてレベルやXPを初期設定しても良い
        setTimeout(onComplete, 3000); // 3秒後に閉じる
    };

    if (!userId) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl animate-bounce-in">
                {!finished ? (
                    <>
                        <h2 className="text-2xl font-bold mb-2">🎓 実力診断テスト</h2>
                        <p className="text-gray-500 mb-6">あなたのレベルを測定します ({step + 1}/{QUESTIONS.length})</p>
                        <div className="text-xl font-bold mb-8 bg-gray-100 p-4 rounded-lg">{QUESTIONS[step].q}</div>
                        <div className="grid grid-cols-2 gap-4">
                            {QUESTIONS[step].options.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAnswer(i)}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-4 rounded-xl transition"
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="py-10">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-3xl font-black text-gray-800 mb-2">Score: {score}/{QUESTIONS.length}</h2>
                        <p className="text-gray-500">診断完了！あなたにぴったりのコースを作成しました。</p>
                    </div>
                )}
            </div>
        </div>
    );
}
