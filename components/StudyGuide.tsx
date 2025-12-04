import { SUPPORTED_LANGUAGES } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { UserProfile, DictionaryData } from '@/types';

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
        <div className={`${isMobile ? 'w-full h-auto mt-6' : 'w-[450px] h-full shrink-0'} flex flex-col ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white/50 border-white/50'}`}>
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-start relative border-gray-200/50">
                <div>
                    <h2 className="text-sm font-bold opacity-70 mb-1">Study Guide</h2>
                    <p className="text-xs opacity-50">Langs (Max 3):</p>
                </div>
                <div className="grid grid-cols-6 gap-1">
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
                                className={`w-6 h-6 flex items-center justify-center rounded text-xs transition ${isSelected ? 'bg-indigo-600 ring-1 ring-indigo-400 grayscale-0 text-white' : 'bg-gray-200 grayscale opacity-50 hover:opacity-100'}`}
                                title={lang.label}
                            >
                                {lang.label.split(' ')[0]}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className={`${isMobile ? '' : 'flex-1 overflow-y-auto'} p-4`}>
                {Object.keys(studyGuides).length > 0 ? (
                    <div className="space-y-6">
                        {/* Summary Challenge (Shared) */}
                        <div className={`p-4 rounded-lg border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-indigo-50 border-indigo-100'}`}>
                            <h3 className={`font-bold mb-2 ${isPro ? 'text-indigo-300' : 'text-indigo-700'}`}>📝 Summary Challenge</h3>

                            {!showModelSummary ? (
                                <div className="space-y-3">
                                    <p className={`text-sm ${isPro ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Watch the video and write a 3-sentence summary!
                                    </p>
                                    <textarea
                                        value={userSummary}
                                        onChange={(e) => setUserSummary(e.target.value)}
                                        className={`w-full p-3 rounded border text-sm ${isPro ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-black'}`}
                                        rows={3}
                                        placeholder="Type your summary here..."
                                    />
                                    <button
                                        onClick={handleCheckSummary}
                                        disabled={isCheckingSummary || !userSummary.trim()}
                                        className={`w-full py-2 rounded font-bold text-white transition ${isCheckingSummary ? 'bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                    >
                                        {isCheckingSummary ? 'Analyzing...' : 'Check My Summary'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className={`p-3 rounded border ${isPro ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                                        <p className="text-xs font-bold opacity-50 mb-1">Your Summary</p>
                                        <p className={`text-sm ${isPro ? 'text-gray-300' : 'text-gray-800'}`}>{userSummary}</p>
                                    </div>

                                    <div className={`p-3 rounded border border-l-4 ${isPro ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-500'}`}>
                                        <p className="text-xs font-bold text-blue-500 mb-1">AI Feedback</p>
                                        <p className={`text-sm ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{summaryFeedback}</p>
                                    </div>

                                    <div className="border-t border-gray-700 pt-3">
                                        <p className="text-xs font-bold opacity-50 mb-2">Model Answers</p>
                                        <div className="space-y-2">
                                            {explanationLangs.map(lang => studyGuides[lang] && (
                                                <div key={lang} className={`p-3 rounded border ${isPro ? 'bg-cyan-900/40 border-cyan-800' : 'bg-white border-gray-200'}`}>
                                                    <p className="text-xs font-bold mb-1 opacity-70 text-cyan-400">{lang}</p>
                                                    <p className={`text-sm leading-relaxed ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{studyGuides[lang].summary}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowModelSummary(false)}
                                        className="text-xs text-gray-500 underline hover:text-gray-700"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Grouped by Section Content */}
                        <div className="space-y-8">

                            {/* Key Sentences Section */}
                            <div>
                                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-yellow-400' : 'text-indigo-700'}`}>
                                    🔑 Key Sentences
                                </h3>
                                <div className="space-y-6">
                                    {(() => {
                                        const masterLang = explanationLangs.find(l => studyGuides[l]);
                                        const masterGuide = masterLang ? studyGuides[masterLang] : null;

                                        if (!masterGuide?.key_sentences) return <p className="text-sm opacity-50">No key sentences found.</p>;

                                        return masterGuide.key_sentences.map((masterItem: any, index: number) => (
                                            <div key={index} className={`p-5 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                {/* Original Sentence */}
                                                <div className="mb-4 flex justify-between items-start gap-4">
                                                    <p className={`font-bold text-lg leading-relaxed ${isPro ? 'text-white' : 'text-gray-900'}`}>{masterItem.sentence}</p>
                                                    <button
                                                        onClick={() => {
                                                            setManualTargetText(masterItem.sentence);
                                                            // スマホの場合は上部のレコーダーまでスクロールした方が親切かも？
                                                            // いったんシンプルにセットのみ
                                                        }}
                                                        className="shrink-0 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white px-3 py-1.5 rounded-full shadow-md transition transform hover:scale-105 text-xs font-bold flex items-center gap-1"
                                                        title="Shadowing Practice"
                                                    >
                                                        🎙️ Shadow
                                                    </button>
                                                </div>

                                                {/* Explanations per Language (Stacked) */}
                                                <div className="flex flex-col gap-2">
                                                    {explanationLangs.map(lang => {
                                                        const guide = studyGuides[lang];
                                                        const item = guide?.key_sentences?.[index] || guide?.key_sentences?.find((s: any) => s.sentence === masterItem.sentence);

                                                        if (!item) return null;

                                                        return (
                                                            <div key={lang} className={`p-3 rounded-lg border-l-4 ${isPro ? 'bg-cyan-900/30 border-cyan-600' : 'bg-gray-50 border-indigo-400'}`}>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className={`text-xs font-bold ${isPro ? 'text-cyan-400' : 'text-indigo-600'}`}>{SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label}</span>
                                                                </div>
                                                                <p className={`text-sm mb-2 ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{item.translation}</p>
                                                                <p className={`text-xs ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>💡 {item.explanation}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Vocabulary Section */}
                            <div>
                                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-green-400' : 'text-indigo-700'}`}>
                                    📚 Vocabulary
                                </h3>
                                <div className="space-y-4">
                                    {(() => {
                                        const masterLang = explanationLangs.find(l => studyGuides[l]);
                                        const masterGuide = masterLang ? studyGuides[masterLang] : null;

                                        if (!masterGuide?.vocabulary) return <p className="text-sm opacity-50">No vocabulary found.</p>;

                                        return masterGuide.vocabulary.map((masterItem: any, index: number) => (
                                            <div key={index} className={`p-4 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <p className={`font-bold text-lg ${isPro ? 'text-white' : 'text-gray-900'}`}>{masterItem.word}</p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!userId) {
                                                                alert("Please login to save vocabulary!");
                                                                return;
                                                            }
                                                            setDictData({ word: masterItem.word, translation: masterItem.meaning, sourceLang: userProfile.learning_target });
                                                            const save = async () => {
                                                                if (!userId) return;
                                                                try {
                                                                    await supabase.from('vocab').insert([{ user_id: userId, word: masterItem.word, translation: masterItem.meaning, subject: userProfile.learning_target }]);
                                                                    await addXp(10); alert(`Saved: ${masterItem.word} (+10 XP)`);
                                                                } catch { alert('Save failed'); }
                                                            };
                                                            save();
                                                        }}
                                                        className={`text-xs px-2 py-1 rounded transition ${userId ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                    >
                                                        {userId ? '＋ Save' : '🔒 Save'}
                                                    </button>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    {explanationLangs.map(lang => {
                                                        const guide = studyGuides[lang];
                                                        const item = guide?.vocabulary?.[index] || guide?.vocabulary?.find((v: any) => v.word === masterItem.word);

                                                        if (!item) return null;

                                                        return (
                                                            <div key={lang} className={`p-2 rounded border-l-4 ${isPro ? 'bg-gray-700/50 border-gray-500' : 'bg-gray-50 border-gray-300'}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-xs font-bold ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>{SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label.split(' ')[0]}</span>
                                                                    <span className={`text-sm ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{item.meaning}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Grammar Section */}
                            <div>
                                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-pink-400' : 'text-indigo-700'}`}>
                                    📐 Grammar
                                </h3>
                                <div className="space-y-4">
                                    {(() => {
                                        const masterLang = explanationLangs.find(l => studyGuides[l]);
                                        const masterGuide = masterLang ? studyGuides[masterLang] : null;

                                        if (!masterGuide?.grammar) return <p className="text-sm opacity-50">No grammar points found.</p>;

                                        return masterGuide.grammar.map((masterItem: any, index: number) => (
                                            <div key={index} className={`p-4 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                <p className={`font-bold text-lg mb-3 ${isPro ? 'text-pink-300' : 'text-pink-700'}`}>{masterItem.point}</p>

                                                <div className="flex flex-col gap-2">
                                                    {explanationLangs.map(lang => {
                                                        const guide = studyGuides[lang];
                                                        const item = guide?.grammar?.[index] || guide?.grammar?.find((g: any) => g.point === masterItem.point);

                                                        if (!item) return null;

                                                        return (
                                                            <div key={lang} className={`p-3 rounded border-l-4 ${isPro ? 'bg-pink-900/20 border-pink-600' : 'bg-pink-50 border-pink-300'}`}>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-xs font-bold ${isPro ? 'text-pink-400' : 'text-pink-600'}`}>{SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label}</span>
                                                                </div>
                                                                <p className={`text-sm ${isPro ? 'text-gray-300' : 'text-gray-600'}`}>{item.explanation}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Quiz Section */}
                            <div>
                                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-orange-400' : 'text-indigo-700'}`}>
                                    🧩 Quiz
                                </h3>
                                <div className="grid grid-cols-1 gap-6">
                                    {explanationLangs.map(lang => {
                                        const guide = studyGuides[lang];
                                        if (!guide?.quiz) return null;
                                        return (
                                            <div key={lang} className={`p-4 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                                <h4 className="font-bold text-sm mb-4 opacity-70 flex items-center gap-2 border-b border-gray-700 pb-2">
                                                    {SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label}
                                                </h4>
                                                <div className="space-y-6">
                                                    {guide.quiz.map((q: any, i: number) => (
                                                        <div key={i} className="text-sm">
                                                            <p className={`font-bold mb-2 text-base ${isPro ? 'text-gray-200' : 'text-gray-800'}`}>Q{i + 1}. {q.question}</p>
                                                            <div className="pl-2 space-y-2">
                                                                {q.options?.map((opt: string, oi: number) => (
                                                                    <div key={oi} className={`p-2 rounded border ${isPro ? 'border-gray-700 bg-gray-900/50 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                                                                        {opt === q.answer ? '✅' : '⚪️'} {opt}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    </div >
                ) : isGeneratingGuide ? (
                    <div className="text-center py-10 animate-pulse">
                        <p className="text-2xl mb-2">🤖</p>
                        <p className="font-bold text-indigo-600">Generating Study Guide...</p>
                        <p className="text-xs text-gray-500">AI is analyzing the video content for you.</p>
                    </div>
                ) : (
                    <div className="text-center py-10 opacity-60">
                        <p className="mb-2 font-bold">Study Guide Not Found</p>
                        <p className="text-xs">Could not generate guide for this video.</p>
                    </div>
                )
                }
            </div >
        </div >
    );
};
