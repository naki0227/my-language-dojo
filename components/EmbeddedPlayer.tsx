'use client';

import { useState } from 'react';
import YouTube from 'react-youtube';

type Props = {
    videoId: string;
    start: number; // 開始時間(秒)
    title: string; // ボタンに表示するテキスト
};

export default function EmbeddedPlayer({ videoId, start, title }: Props) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* 1. 記事の中に置かれる「再生ボタン」 */}
            <div className="my-4 border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg hover:bg-blue-100 transition">
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-3 text-blue-700 font-bold hover:underline focus:outline-none w-full text-left"
                >
                    <span className="text-2xl bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-sm">
                        ▶
                    </span>
                    <div>
                        <span className="block text-xs text-gray-500">Click to play</span>
                        <span>{title}</span>
                    </div>
                </button>
            </div>

            {/* 2. 画面の隅に固定表示される「ミニプレイヤー」 */}
            {isOpen && (
                <div className={`
          fixed z-50 bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-white animate-fade-in
          
          /* スマホ: 右下に固定 (幅は画面の半分くらい) */
          bottom-4 right-4 w-[200px]
          
          /* PC: 右上に固定 (幅320px) */
          md:top-24 md:right-10 md:w-[320px] md:bottom-auto
        `}>
                    {/* 閉じるボタンバー */}
                    <div className="bg-gray-900 text-white flex justify-between items-center px-2 py-1">
                        <span className="text-[10px] truncate flex-1 mr-2 text-gray-300">
                            Playing: {title}
                        </span>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white font-bold px-2"
                        >
                            ×
                        </button>
                    </div>

                    {/* YouTube本体 */}
                    <div className="aspect-video w-full relative">
                        <YouTube
                            videoId={videoId}
                            opts={{
                                width: '100%',
                                height: '100%',
                                playerVars: {
                                    autoplay: 1, // 開いたらすぐ再生
                                    start: start, // 指定時間から開始
                                    modestbranding: 1,
                                    controls: 1,
                                },
                            }}
                            className="absolute top-0 left-0 w-full h-full"
                            onEnd={() => setIsOpen(false)} // 動画が終わったら自動で閉じる
                        />
                    </div>
                </div>
            )}
        </>
    );
}

