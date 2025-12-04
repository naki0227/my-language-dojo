// components/VoiceRecorder.tsx
'use client';

import { useState, useRef } from 'react';

// お手本のテキストを受け取るための型定義
type Props = {
    targetText: string; // ← 親から受け取る「今練習すべき文章」
};

import { getApiUrl } from '@/lib/api';

export default function VoiceRecorder({ targetText }: { targetText: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGrading, setIsGrading] = useState(false);
    const [result, setResult] = useState<any>(null); // AIの採点結果

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // 録音開始
    const startRecording = async () => {
        setResult(null); // 前の結果をリセット
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            alert('マイクの使用を許可してください');
        }
    };

    // 録音停止
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    };

    // AI採点リクエスト
    const handleGrade = async () => {
        if (!audioBlob || !targetText) return;

        setIsGrading(true);
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('text', targetText);

        try {
            const res = await fetch(getApiUrl('/api/grade'), {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            setResult(data);
        } catch (e) {
            alert('採点に失敗しました');
        } finally {
            setIsGrading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-6 bg-white rounded-xl shadow-md border border-blue-100 w-full transition-all">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-700">🎤 AIシャドーイング</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Gemini 2.5 Flash</span>
            </div>

            {/* 練習中の文章表示 */}
            <div className="bg-gray-50 p-3 rounded text-gray-600 text-sm italic">
                Target: "{targetText || '（字幕をクリックして練習する文章を選んでください）'}"
            </div>

            {/* 録音コントロール */}
            <div className="flex items-center gap-4 justify-center py-2">
                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        disabled={!targetText}
                        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition text-2xl text-white
              ${targetText ? 'bg-red-500 hover:bg-red-600 hover:scale-110' : 'bg-gray-300 cursor-not-allowed'}
            `}
                    >
                        🎙️
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        className="bg-gray-800 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg animate-pulse text-2xl"
                    >
                        ⏹️
                    </button>
                )}
            </div>

            {/* 録音後の操作エリア */}
            {audioUrl && !isRecording && (
                <div className="animate-fade-in space-y-4">
                    <audio controls src={audioUrl} className="w-full h-8" />

                    <button
                        onClick={handleGrade}
                        disabled={isGrading}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-bold shadow-lg hover:opacity-90 transition flex justify-center items-center gap-2"
                    >
                        {isGrading ? (
                            <><span>思考中...</span><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div></>
                        ) : (
                            '🤖 AI採点スタート (Check Pronunciation)'
                        )}
                    </button>
                </div>
            )}

            {/* 採点結果表示 */}
            {result && (
                <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg animate-bounce-in">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-gray-600 font-bold">Score</span>
                        <span className="text-4xl font-black text-green-600">{result.score}<span className="text-lg text-gray-400">/100</span></span>
                    </div>

                    <div className="space-y-2">
                        <p className="text-gray-800 font-bold">{result.feedback}</p>

                        {result.mispronounced_words?.length > 0 && (
                            <div className="text-sm">
                                <span className="text-red-500 font-bold">注意すべき単語: </span>
                                {result.mispronounced_words.join(', ')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
