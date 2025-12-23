import { useState } from 'react';
import { SUPPORTED_LANGUAGES } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { UserProfile, DictionaryData } from '@/types';
import { BookOpen, Check, ChevronRight, Hash, Languages, MessageSquare, Trophy, AlertCircle } from 'lucide-react';

interface StudyGuideProps {
    isMobile: boolean;
    isPro: boolean;
    explanationLangs: string[];
    studyGuides: Record<string, any>;
    isGeneratingGuide: boolean;
    userSummary: string;
    setUserSummary: (s: string) => void;
    handleCheckSummary: () => void;
    isCheckingSummary: boolean;
    showModelSummary: boolean;
    setShowModelSummary: (b: boolean) => void;
    summaryFeedback: string | null;
    videoId: string;
    loadVideo: (id: string, langs: string[]) => void;
    setManualTargetText: (text: string | null) => void;
    userId: string | null;
    userProfile: UserProfile;
    setDictData: (data: DictionaryData | null) => void;
    addXp: (amount: number) => Promise<void>;
}

export const StudyGuide = ({
    isMobile,
    isPro,
    explanationLangs,
    studyGuides,
    isGeneratingGuide,
    userSummary,
    setUserSummary,
    handleCheckSummary,
    isCheckingSummary,
    showModelSummary,
    setShowModelSummary,
    summaryFeedback,
    videoId,
    loadVideo,
    setManualTargetText,
    userId,
    userProfile,
    setDictData,
    addXp
}: StudyGuideProps) => {
    return (
        <div className={`${isMobile ? 'w-full h-auto mt-8' : 'w-[450px] h-full shrink-0'} flex flex-col bg-gray-50/50`}>
            {/* Header */}
            <div className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-base font-bold text-gray-800">Study Guide</h2>
                </div>

                <div className="flex gap-1.5">
                    {SUPPORTED_LANGUAGES.map(lang => {
                        const isSelected = explanationLangs.includes(lang.dbName);
                        return (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    let newLangs = [...explanationLangs];
                                    if (isSelected) {
                                        if (newLangs.length > 1) newLangs = newLangs.filter(l => l !== lang.dbName);
                                    } else {
                                        if (newLangs.length < 3) newLangs.push(lang.dbName);
                                    }
                                    loadVideo(videoId, newLangs);
                                }}
                                className={`
                                    w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all duration-200
                                    ${isSelected
                                        ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-md transform scale-105'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                    }
                                `}
                                title={lang.label}
                            >
                                {lang.label.split(' ')[0]}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={`${isMobile ? '' : 'flex-1 overflow-y-auto custom-scrollbar'} p-4 md:p-6 space-y-8`}>
                {Object.keys(studyGuides).length > 0 ? (
                    <div className="space-y-10">

                        {/* Summary Challenge */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-orange-100 text-orange-600 p-1.5 rounded-lg"><MessageSquare className="w-4 h-4" /></span>
                                <h3 className="font-bold text-gray-800">Summary Challenge</h3>
                            </div>

                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                                {!showModelSummary ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            Watch the video and write a short summary to check your understanding.
                                        </p>
                                        <textarea
                                            value={userSummary}
                                            onChange={(e) => setUserSummary(e.target.value)}
                                            className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-300 resize-none"
                                            rows={4}
                                            placeholder="Example: This video explains the concept of..."
                                        />
                                        <button
                                            onClick={handleCheckSummary}
                                            disabled={isCheckingSummary || !userSummary.trim()}
                                            className={`
                                                w-full py-3.5 rounded-xl font-bold text-white transition-all transform active:scale-[0.98] shadow-lg
                                                ${isCheckingSummary
                                                    ? 'bg-gray-400 cursor-wait'
                                                    : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:shadow-indigo-500/30'
                                                }
                                            `}
                                        >
                                            {isCheckingSummary ? 'Analyzing...' : 'Check My Summary'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6 animate-in fade-in duration-500">
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Your Output</p>
                                            <p className="text-gray-800 text-sm leading-relaxed">{userSummary}</p>
                                        </div>

                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="bg-blue-100 p-1 rounded-full"><Trophy className="w-3 h-3 text-blue-600" /></div>
                                                <p className="text-sm font-bold text-blue-700">AI Feedback</p>
                                            </div>
                                            <p className="text-sm text-blue-900/80 leading-relaxed">{summaryFeedback}</p>
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Model Answer</p>
                                            {explanationLangs.map(lang => studyGuides[lang] && (
                                                <div key={lang} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                                    <p className="text-xs font-bold mb-2 text-indigo-500 flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                        {lang}
                                                    </p>
                                                    <p className="text-sm text-gray-700 leading-relaxed">{studyGuides[lang].summary}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => setShowModelSummary(false)}
                                            className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Key Sentences */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-yellow-100 text-yellow-600 p-1.5 rounded-lg"><ChevronRight className="w-4 h-4" /></span>
                                <h3 className="font-bold text-gray-800">Key Sentences</h3>
                            </div>

                            <div className="space-y-4">
                                {(() => {
                                    const masterLang = explanationLangs.find(l => studyGuides[l]);
                                    const masterGuide = masterLang ? studyGuides[masterLang] : null;

                                    if (!masterGuide?.key_sentences) return <p className="text-center text-gray-400 text-sm py-4">No data available.</p>;

                                    return masterGuide.key_sentences.map((masterItem: any, index: number) => (
                                        <div key={index} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:border-indigo-100 transition-colors">
                                            <div className="flex justify-between items-start gap-3 mb-4">
                                                <p className="font-bold text-gray-800 text-lg leading-relaxed">{masterItem.sentence}</p>
                                                <button
                                                    onClick={() => {
                                                        setManualTargetText(masterItem.sentence);
                                                        if (isMobile) window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="shrink-0 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 p-2 rounded-full transition-all"
                                                    title="Shadowing Practice"
                                                >
                                                    <div className="flex items-center gap-1 text-xs font-bold px-1">
                                                        🎙️
                                                    </div>
                                                </button>
                                            </div>

                                            <div className="space-y-3">
                                                {explanationLangs.map(lang => {
                                                    const guide = studyGuides[lang];
                                                    const item = guide?.key_sentences?.[index] || guide?.key_sentences?.find((s: any) => s.sentence === masterItem.sentence);

                                                    if (!item) return null;

                                                    return (
                                                        <div key={lang} className="text-sm border-l-2 border-gray-100 pl-3 py-1">
                                                            <p className="font-medium text-gray-700 mb-1">{item.translation}</p>
                                                            <p className="text-gray-500 text-xs leading-relaxed">{item.explanation}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </section>

                        {/* Vocabulary */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-green-100 text-green-600 p-1.5 rounded-lg"><BookOpen className="w-4 h-4" /></span>
                                <h3 className="font-bold text-gray-800">Vocabulary</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {(() => {
                                    const masterLang = explanationLangs.find(l => studyGuides[l]);
                                    const masterGuide = masterLang ? studyGuides[masterLang] : null;

                                    if (!masterGuide?.vocabulary) return <p className="text-center text-gray-400 text-sm py-4">No vocabulary found.</p>;

                                    return masterGuide.vocabulary.map((masterItem: any, index: number) => (
                                        <div key={index} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3 transition-transform hover:scale-[1.01]">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-lg text-gray-800">{masterItem.word}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!userId) {
                                                            alert("Please login to save vocabulary!");
                                                            return;
                                                        }
                                                        setDictData({ word: masterItem.word, translation: masterItem.meaning, sourceLang: userProfile.learning_target });
                                                        const save = async () => {
                                                            try {
                                                                await supabase.from('vocab').insert([{ user_id: userId, word: masterItem.word, translation: masterItem.meaning, subject: userProfile.learning_target }]);
                                                                await addXp(10);
                                                            } catch { alert('Save failed'); }
                                                        };
                                                        save();
                                                    }}
                                                    className={`text-xs px-2.5 py-1.5 rounded-full font-bold transition-colors ${userId ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-400'}`}
                                                >
                                                    {userId ? '+ Save' : 'Login to Save'}
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                {explanationLangs.map(lang => {
                                                    const guide = studyGuides[lang];
                                                    const item = guide?.vocabulary?.[index] || guide?.vocabulary?.find((v: any) => v.word === masterItem.word);
                                                    if (!item) return null;
                                                    return (
                                                        <div key={lang} className="text-sm text-gray-600 flex gap-2">
                                                            <span className="text-xs text-gray-400 font-medium w-6 shrink-0 pt-0.5">{SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label.slice(0, 2)}</span>
                                                            <span>{item.meaning}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </section>

                        {/* Grammar */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-pink-100 text-pink-600 p-1.5 rounded-lg"><Hash className="w-4 h-4" /></span>
                                <h3 className="font-bold text-gray-800">Grammar Point</h3>
                            </div>

                            <div className="space-y-4">
                                {(() => {
                                    const masterLang = explanationLangs.find(l => studyGuides[l]);
                                    const masterGuide = masterLang ? studyGuides[masterLang] : null;

                                    if (!masterGuide?.grammar) return <p className="text-center text-gray-400 text-sm py-4">No grammar data.</p>;

                                    return masterGuide.grammar.map((masterItem: any, index: number) => (
                                        <div key={index} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-pink-400"></div>
                                            <p className="font-bold text-lg text-gray-800 mb-3 ml-2">{masterItem.point}</p>

                                            <div className="ml-2 space-y-3">
                                                {explanationLangs.map(lang => {
                                                    const guide = studyGuides[lang];
                                                    const item = guide?.grammar?.[index] || guide?.grammar?.find((g: any) => g.point === masterItem.point);
                                                    if (!item) return null;
                                                    return (
                                                        <div key={lang} className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                                            {item.explanation}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </section>

                        {/* Quiz */}
                        <section className="pb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><Languages className="w-4 h-4" /></span>
                                <h3 className="font-bold text-gray-800">Review Quiz</h3>
                            </div>

                            <div className="space-y-6">
                                {explanationLangs.map(lang => {
                                    const guide = studyGuides[lang];
                                    if (!guide?.quiz) return null;

                                    // eslint-disable-next-line react-hooks/rules-of-hooks
                                    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
                                    // eslint-disable-next-line react-hooks/rules-of-hooks
                                    const [showResults, setShowResults] = useState(false);
                                    // eslint-disable-next-line react-hooks/rules-of-hooks
                                    const [score, setScore] = useState(0);

                                    const handleOptionSelect = (qIndex: number, option: string) => {
                                        if (showResults) return;
                                        setSelectedAnswers(prev => ({ ...prev, [qIndex]: option }));
                                    };

                                    const handleSubmit = () => {
                                        let correctCount = 0;
                                        guide.quiz.forEach((q: any, i: number) => {
                                            if (selectedAnswers[i] === q.answer) correctCount++;
                                        });
                                        setScore(correctCount);
                                        setShowResults(true);
                                        if (correctCount > 0) addXp(correctCount * 5);
                                    };

                                    return (
                                        <div key={lang} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-50">
                                                <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded">
                                                    {SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label}
                                                </span>
                                            </div>

                                            <div className="space-y-8">
                                                {guide.quiz.map((q: any, i: number) => {
                                                    const isCorrect = selectedAnswers[i] === q.answer;
                                                    const isSelected = selectedAnswers[i] !== undefined;

                                                    return (
                                                        <div key={i}>
                                                            <div className="flex gap-3 mb-3">
                                                                <span className="font-black text-gray-300 text-xl font-mono">0{i + 1}</span>
                                                                <p className="font-bold text-gray-800 pt-1">{q.question}</p>
                                                            </div>

                                                            <div className="pl-8 space-y-2.5">
                                                                {q.options?.map((opt: string, oi: number) => {
                                                                    const isSelectedOption = selectedAnswers[i] === opt;
                                                                    const isCorrectOption = opt === q.answer;

                                                                    let btnClass = 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300';

                                                                    if (showResults) {
                                                                        if (isCorrectOption) btnClass = 'bg-green-50 border-green-500 text-green-700 font-bold';
                                                                        else if (isSelectedOption) btnClass = 'bg-red-50 border-red-300 text-red-400 opacity-70';
                                                                        else btnClass = 'bg-gray-50 border-gray-100 text-gray-300';
                                                                    } else {
                                                                        if (isSelectedOption) btnClass = 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold shadow-sm';
                                                                    }

                                                                    return (
                                                                        <button
                                                                            key={oi}
                                                                            onClick={() => handleOptionSelect(i, opt)}
                                                                            className={`w-full p-3.5 rounded-xl border text-left text-sm transition-all duration-200 flex justify-between items-center ${btnClass}`}
                                                                        >
                                                                            <span>{opt}</span>
                                                                            {showResults && isCorrectOption && <Check className="w-4 h-4 text-green-600" />}
                                                                            {showResults && isSelectedOption && !isCorrectOption && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {!showResults ? (
                                                <button
                                                    onClick={handleSubmit}
                                                    disabled={Object.keys(selectedAnswers).length < guide.quiz.length}
                                                    className={`
                                                        mt-8 w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98]
                                                        ${Object.keys(selectedAnswers).length < guide.quiz.length
                                                            ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                                            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:shadow-indigo-500/30'
                                                        }
                                                    `}
                                                >
                                                    Check Answers
                                                </button>
                                            ) : (
                                                <div className="mt-8 p-6 bg-gray-900 rounded-2xl text-center relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50"></div>
                                                    <div className="relative z-10">
                                                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Score</p>
                                                        <p className="text-4xl font-black text-white mb-2 tracking-tight">
                                                            {score} <span className="text-xl text-gray-500 font-medium">/ {guide.quiz.length}</span>
                                                        </p>
                                                        <p className="text-indigo-200 text-sm mb-6">
                                                            {score === guide.quiz.length ? 'Perfection! Excellent work! 🎉' : 'Keep watching and trying! 💪'}
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                setShowResults(false);
                                                                setSelectedAnswers({});
                                                                setScore(0);
                                                            }}
                                                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            Try Again
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                    </div>
                ) : isGeneratingGuide ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="w-8 h-8 text-indigo-500 opacity-50" />
                        </div>
                        <p className="font-bold text-gray-800 text-lg">Generating Study Guide...</p>
                        <p className="text-sm text-gray-500 mt-2">AI is analyzing the video content for you.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-60">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="font-bold text-gray-800">No Study Guide</p>
                        <p className="text-sm text-gray-500 mt-1 max-w-[200px] text-center">Video content might be too short or could not be processed.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
