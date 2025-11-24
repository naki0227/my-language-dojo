// components/UserStatus.tsx
'use client';

type Props = {
    level: string;
    xp: number;
    nextLevelXp: number;
};

export default function UserStatus({ level, xp, nextLevelXp }: Props) {
    // 進捗率（%）を計算
    const progress = Math.min(100, Math.max(0, (xp / nextLevelXp) * 100));

    return (
        <div className="bg-white px-4 py-2 rounded-lg shadow-md border border-gray-200 flex items-center gap-4 min-w-[200px]">
            {/* レベルバッジ */}
            <div className="relative">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-yellow-500 shadow-sm">
                    <span className="font-black text-white text-lg drop-shadow-md">{level}</span>
                </div>
                <span className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[10px] px-1 rounded font-bold">
                    LV
                </span>
            </div>

            {/* XPバー */}
            <div className="flex-1">
                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span>EXP</span>
                    <span>{xp} / {nextLevelXp}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-full transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
