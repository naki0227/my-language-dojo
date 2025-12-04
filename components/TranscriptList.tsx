import { Subtitle } from '@/types';

interface TranscriptListProps {
    isSubtitleLoading: boolean;
    subtitles: Subtitle[];
    isPro: boolean;
    manualTargetText: string | null;
    setManualTargetText: (text: string | null) => void;
    handleSeek: (ms: number) => void;
    handleWordClick: (word: string, e: React.MouseEvent) => void;
    showTranslation: boolean;
    selectedLangs: string[];
}

export const TranscriptList = ({
    isSubtitleLoading,
    subtitles,
    isPro,
    manualTargetText,
    setManualTargetText,
    handleSeek,
    handleWordClick,
    showTranslation,
    selectedLangs
}: TranscriptListProps) => (
    <div className="space-y-3">
        {isSubtitleLoading ? (
            <div className="text-center py-10 text-gray-500 animate-pulse">字幕データを取得中...</div>
        ) : subtitles.length > 0 ? (
            subtitles.map((sub, i) => (
                <div key={i} onClick={() => { handleSeek(sub.offset); setManualTargetText(sub.text); }} className={`cursor-pointer p-3 rounded text-base leading-relaxed transition-colors border-b ${isPro ? 'border-gray-700 hover:bg-gray-700 text-gray-300' : 'border-gray-50 hover:bg-gray-100 text-gray-700'} ${manualTargetText === sub.text ? (isPro ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-green-50 border-l-4 border-green-500') : ''}`}>
                    <div className="mb-1">{(sub.text || '').split(' ').map((word, wIndex) => (<span key={wIndex} onClick={(e) => handleWordClick(word, e)} className={`inline-block mx-0.5 px-0.5 rounded ${word.length >= 6 ? 'text-blue-500 font-bold' : ''}`}>{word}</span>))}</div>
                    {showTranslation && sub.translation && (<div className="mt-1 text-sm text-blue-600 font-bold">{sub.translation}</div>)}
                    {selectedLangs.map(lang => (sub.translations && sub.translations[lang] ? (<div key={lang} className="text-sm text-gray-500 mt-1 border-l-2 border-blue-200 pl-2"><span className="text-xs font-bold text-blue-400 mr-1">{lang.toUpperCase()}:</span>{sub.translations[lang]}</div>) : null))}
                </div>
            ))
        ) : (
            <div className="text-center py-10 opacity-60">
                <p className="mb-2 font-bold">字幕データがありません</p>
                <p className="text-xs">Adminで生成されているか確認してください。</p>
            </div>
        )}
    </div>
);
