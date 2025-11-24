'use client';

import { useState } from 'react';

type Question = {
    q: string;
    options: string[];
    answer: number;
    explanation: string;
};

type Props = {
    questions: Question[];
    onClose: () => void;
};

export default function DailyQuiz({ questions, onClose }: Props) {
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);

    const handleAnswer = (choiceIndex: number) => {
        if (selected !== null) return;
        setSelected(choiceIndex);
        if (choiceIndex === questions[index].answer) {
            setScore(score + 1);
        }
    };

    const nextQuestion = () => {
        if (index < questions.length - 1) {
            setIndex(index + 1);
            setSelected(null);
        } else {
            setShowResult(true);
        }
    };

    if (!questions || questions.length === 0) return null;

    const q = questions[index];

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 animate-bounce-in text-black">
                {showResult ? (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">
                            {score === questions.length ? '🏆' : score >= 1 ? '👍' : '💪'}
                        </div>
                        <h2 className="text-3xl font-black text-gray-800 mb-2">Score: {score}/{questions.length}</h2>
                        <p className="text-gray-500 mb-6">
                            {score === questions.length ? 'Perfect! 全問正解です！' : 'Good try! 明日も挑戦しよう！'}
                        </p>
                        <button onClick={onClose} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition">
                            閉じる
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <span className="font-bold text-gray-500 text-sm">Q{index + 1} of {questions.length}</span>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-6 leading-relaxed">
                            {q.q}
                        </h3>

                        <div className="space-y-3 mb-6">
                            {q.options.map((opt, i) => {
                                let btnClass = "bg-white border-2 border-gray-200 hover:border-blue-400 text-gray-700";
                                if (selected !== null) {
                                    if (i === q.answer) btnClass = "bg-green-100 border-green-500 text-green-800 font-bold";
                                    else if (i === selected) btnClass = "bg-red-100 border-red-500 text-red-800";
                                    else btnClass = "bg-gray-50 border-gray-100 text-gray-300";
                                }
                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleAnswer(i)}
                                        disabled={selected !== null}
                                        className={`w-full p-4 rounded-xl text-left transition-all ${btnClass}`}
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>

                        {selected !== null && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                                <p className="text-sm text-gray-800 font-bold mb-1">💡 解説</p>
                                <p className="text-sm text-gray-600">{q.explanation}</p>
                                <button
                                    onClick={nextQuestion}
                                    className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                                >
                                    {index < questions.length - 1 ? "Next →" : "結果を見る"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

