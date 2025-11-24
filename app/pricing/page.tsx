'use client';

import Link from 'next/link';

export default function PricingPage() {
    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-black text-gray-800 mb-4">Unlock Your Potential 🚀</h1>
                <p className="text-gray-600">あなたの学習スピードを加速させるプランを選んでください。</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
                {/* Free Plan */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Free Plan</h2>
                    <p className="text-gray-500 mb-6">まずはここからスタート</p>
                    <div className="text-4xl font-black text-gray-800 mb-8">¥0 <span className="text-base font-normal text-gray-500">/月</span></div>

                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-2">✅ 動画視聴 & 字幕 (無制限)</li>
                        <li className="flex items-center gap-2">✅ 辞書・単語帳 (無制限)</li>
                        <li className="flex items-center gap-2">⚠️ AI翻訳・採点 (1日3回まで)</li>
                        <li className="flex items-center gap-2">⚠️ 教科書閲覧 (一部のみ)</li>
                    </ul>

                    <Link href="/" className="block w-full py-3 rounded-xl font-bold text-center border border-gray-300 text-gray-700 hover:bg-gray-50">
                        無料で使い続ける
                    </Link>
                </div>

                {/* Pro Plan */}
                <div className="bg-gradient-to-b from-blue-600 to-indigo-700 p-8 rounded-2xl shadow-2xl text-white flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-xl">RECOMMENDED</div>
                    <h2 className="text-2xl font-bold mb-2">Pro Plan</h2>
                    <p className="text-blue-100 mb-6">本気で英語をマスターしたい人へ</p>
                    <div className="text-4xl font-black mb-8">¥500 <span className="text-base font-normal text-blue-200">/月</span></div>

                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-2">✨ <strong>AI翻訳・採点 (使い放題)</strong></li>
                        <li className="flex items-center gap-2">✨ <strong>全ての教科書にアクセス</strong></li>
                        <li className="flex items-center gap-2">✨ <strong>広告なし・優先サポート</strong></li>
                        <li className="flex items-center gap-2">✨ <strong>Pro限定バッジ付与</strong></li>
                    </ul>

                    <button
                        onClick={() => alert('決済機能は準備中です。開発者に連絡してください！')}
                        className="block w-full py-3 rounded-xl font-bold text-center bg-white text-blue-600 hover:bg-blue-50 shadow-lg transition transform hover:scale-105"
                    >
                        Proにアップグレード
                    </button>
                </div>
            </div>
        </main>
    );
}

