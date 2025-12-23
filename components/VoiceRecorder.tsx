'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Play, AlertCircle } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// Helper to find supported MIME type
const getSupportedMimeType = () => {
    const types = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/wav'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return ''; // fallback
};

export default function VoiceRecorder({ targetText }: { targetText: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGrading, setIsGrading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Cleanup URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const startRecording = async () => {
        setResult(null);
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedMimeType();

            // Allow empty mimeType as fallback (browser default)
            const options = mimeType ? { mimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                // Use the same type for blob creation
                const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err: any) {
            console.error('Recording failed:', err);
            alert(`マイクの使用を許可してください (${err.message})`);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    };

    const handleGrade = async () => {
        if (!audioBlob || !targetText) return;
        setIsGrading(true);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64String = reader.result?.toString();
                if (!base64String) {
                    throw new Error('音声データの変換に失敗しました');
                }

                // Extract pure base64 part correctly regardless of mime type
                const base64Audio = base64String.split(',')[1];

                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                const res = await fetch(getApiUrl('/api/grade'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        targetText,
                        audioData: base64Audio,
                        mimeType: audioBlob.type // Send actual MIME type
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || '採点に失敗しました');
                }

                const data = await res.json();
                setResult(data);
                setIsGrading(false);
            };
            reader.onerror = () => {
                throw new Error('音声ファイルの読み込みに失敗しました');
            };
        } catch (e: any) {
            console.error(e);
            alert(`Error: ${e.message}`);
            setIsGrading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
            {/* Header / Target Text */}
            <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Mic className="w-4 h-4" /> Shadowing
                    </h3>
                    <span className="text-[10px] font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                        Gemini 2.5
                    </span>
                </div>

                <div className="relative">
                    <div className={`p-4 rounded-2xl bg-white border-2 border-dashed transition-all duration-300 ${targetText ? 'border-indigo-100 shadow-sm' : 'border-gray-200'}`}>
                        {targetText ? (
                            <p className="text-lg font-medium text-gray-800 leading-relaxed text-center">
                                "{targetText}"
                            </p>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-sm text-gray-400 font-medium">Select a sentence to practice</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="p-6 flex flex-col items-center gap-6">

                {/* Main Record Button */}
                <div className="relative group">
                    <div className={`absolute inset-0 bg-red-500 rounded-full blur-xl opacity-20 transition-opacity duration-300 ${isRecording ? 'opacity-50 scale-150' : 'group-hover:opacity-30'}`}></div>
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={!targetText}
                        className={`
                            relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform
                            ${!targetText
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed scale-95'
                                : isRecording
                                    ? 'bg-red-500 text-white scale-110 ring-4 ring-red-100'
                                    : 'bg-white text-red-500 border-2 border-red-50 hover:border-red-100 hover:scale-105 active:scale-95'
                            }
                        `}
                    >
                        {isRecording ? (
                            <Square className="w-8 h-8 fill-current animate-pulse" />
                        ) : (
                            <Mic className="w-8 h-8" strokeWidth={2.5} />
                        )}
                    </button>
                    {isRecording && (
                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-red-500 animate-pulse whitespace-nowrap">
                            Recording...
                        </span>
                    )}
                </div>

                {/* Playback & Grade Actions */}
                {audioUrl && !isRecording && (
                    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gray-50 rounded-xl p-2 flex items-center gap-3">
                            <audio controls src={audioUrl} className="w-full h-10 accent-indigo-500" />
                        </div>

                        <button
                            onClick={handleGrade}
                            disabled={isGrading}
                            className={`
                                w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98]
                                flex items-center justify-center gap-2
                                ${isGrading
                                    ? 'bg-gray-400 cursor-wait'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-indigo-500/30'
                                }
                            `}
                        >
                            {isGrading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Analyzing...</span>
                                </>
                            ) : (
                                <>
                                    <span>Check Pronunciation</span>
                                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">AI</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Result Display */}
                {result && (
                    <div className="w-full animate-in zoom-in-95 duration-500">
                        <div className="p-1 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-200">
                            <div className="bg-white rounded-xl p-5 text-center">
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Score</p>
                                <div className="flex justify-center items-baseline gap-1 mb-4">
                                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-700">
                                        {result.score}
                                    </span>
                                    <span className="text-gray-300 font-bold">/100</span>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 font-medium leading-relaxed mb-3 text-left">
                                    {result.feedback}
                                </div>

                                {result.mispronounced_words?.length > 0 && (
                                    <div className="text-left bg-red-50 rounded-lg p-3 border border-red-100">
                                        <p className="text-red-500 text-xs font-bold flex items-center gap-1 mb-1">
                                            <AlertCircle className="w-3 h-3" /> Improvement needed:
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {result.mispronounced_words.map((w: string, i: number) => (
                                                <span key={i} className="text-xs bg-white text-red-600 px-2 py-0.5 rounded border border-red-100 font-medium">
                                                    {w}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

