import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, HelpCircle } from 'lucide-react';

interface PlayerAreaProps {
    videoId: string;
    isAudioOnly: boolean;
    setIsAudioOnly: (value: boolean) => void;
    playError: boolean;
    setPlayError: (value: boolean) => void;
    onPlayerReady: (player: any) => void;
}

export const VideoPlayerArea = ({ videoId, isAudioOnly, setIsAudioOnly, playError, setPlayError, onPlayerReady }: PlayerAreaProps) => {
    const [origin, setOrigin] = useState('');
    const playerRef = useRef<any | null>(null);

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    useEffect(() => {
        if (playError || isAudioOnly) return;

        const initPlayer = () => {
            if ((window as any).YT && (window as any).YT.Player) {
                try {
                    if (playerRef.current) {
                        try { playerRef.current.destroy(); } catch (e) { console.error(e); }
                    }

                    playerRef.current = new (window as any).YT.Player('youtube-player', {
                        events: {
                            'onReady': (e: any) => onPlayerReady(e.target),
                            'onError': (e: any) => {
                                console.warn("YouTube Player Error:", e.data);
                                setPlayError(true);
                            }
                        }
                    });
                } catch (e) {
                    console.error("Player init error", e);
                }
            }
        };

        if (!(window as any).YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
            (window as any).onYouTubeIframeAPIReady = initPlayer;
        } else {
            initPlayer();
        }

        return () => {
            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch (e) { console.error(e); }
            }
        };
    }, [videoId, playError, isAudioOnly, onPlayerReady, setPlayError]);

    return (
        <div className={`relative aspect-video rounded-lg overflow-hidden shadow-xl bg-black ${isAudioOnly ? 'h-12' : ''} relative group`}>
            {playError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center z-10">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
                    <h3 className="text-xl font-bold mb-2">埋め込み再生できません</h3>
                    <p className="text-sm text-gray-400 mb-6">YouTube公式で視聴してください。</p>
                    <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 transition transform hover:scale-105">
                        <ExternalLink size={20} /> YouTubeで開く
                    </a>
                </div>
            ) : isAudioOnly ? (
                <div className="w-full h-full flex items-center justify-center text-white text-xs cursor-pointer" onClick={() => setIsAudioOnly(false)}>🙈 Audio Only (Tap)</div>
            ) : (
                <iframe
                    id="youtube-player"
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=0&enablejsapi=1&origin=${origin}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                />
            )}

            {!playError && !isAudioOnly && (
                <button
                    onClick={() => setPlayError(true)}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full z-20 backdrop-blur-sm transition opacity-70 hover:opacity-100"
                    title="動画が再生できない場合はこちら (YouTubeで開く)"
                >
                    <HelpCircle size={24} />
                </button>
            )}
        </div>
    );
};
