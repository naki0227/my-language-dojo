'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ExamDrill() {
    const { id } = useParams();
    const [questions, setQuestions] = useState<any[]>([]);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        const fetchQ = async () => {
            const { data } = await supabase.from('exercise_questions').select('*').eq('exercise_id', id);
            if (data) setQuestions(data);
        };
        fetchQ();
    }, [id]);

    const handleAnswer = (choiceIndex: number) => {
        if (selected !== null) return; // 二回押し防止
        setSelected(choiceIndex);
        if (choiceIndex === questions[index].answer_index) {
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

    if (questions.length === 0) return <div className="p-10 text-center">Loading questions...</div>;

    if (showResult) {
        return (
            <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-4xl font-black text-green-600 mb-4">Result</h1>
                <p className="text-2xl text-gray-800 mb-8">
                    正解数: <span className="font-bold text-4xl">{score}</span> / {questions.length}
                </p>
                <Link href="/drill" className="bg-gray-800 text-white px-8 py-3 rounded-lg font-bold">一覧に戻る</Link>
            </div>
        );
    }

    const q = questions[index];

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <span className="font-bold text-gray-500">Question {index + 1} / {questions.length}</span>
                    <Link href="/drill" className="text-gray-400 hover:text-black">中断</Link>
                </div>

                {/* 問題文 */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-200">
                    <p className="text-lg text-gray-800 font-medium whitespace-pre-wrap">{q.question}</p>
                </div>

                {/* 選択肢 */}
                <div className="space-y-3 mb-6">
                    {q.options.map((opt: string, i: number) => {
                        let btnClass = "bg-white border-2 border-gray-200 hover:border-blue-300 text-gray-700";
                        if (selected !== null) {
                            if (i === q.answer_index) btnClass = "bg-green-100 border-green-500 text-green-800 font-bold"; // 正解
                            else if (i === selected) btnClass = "bg-red-100 border-red-500 text-red-800"; // 間違い
                            else btnClass = "bg-gray-100 border-gray-200 text-gray-400"; // その他
                        }

                        return (
                            <button
                                key={i}
                                onClick={() => handleAnswer(i)}
                                disabled={selected !== null}
                                className={`w-full p-4 rounded-lg text-left transition-all ${btnClass}`}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {/* 解説エリア (回答後に表示) */}
                {selected !== null && (
                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 animate-fade-in">
                        <div className="font-bold mb-2 text-blue-800">
                            {selected === q.answer_index ? "⭕️ Correct!" : "❌ Incorrect..."}
                        </div>
                        <p className="text-sm text-gray-700">{q.explanation}</p>
                        <button
                            onClick={nextQuestion}
                            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                        >
                            {index < questions.length - 1 ? "Next Question →" : "Show Result"}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}

