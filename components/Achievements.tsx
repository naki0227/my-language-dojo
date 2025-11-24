'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Achievement = {
    id: string;
    title: string;
    description: string;
    icon: string;
    earned_at?: string;
};

export default function Achievements({ userId }: { userId: string }) {
    const [achievements, setAchievements] = useState<Achievement[]>([]);

    useEffect(() => {
        const fetchAchievements = async () => {
            // マスタ取得
            const { data: all } = await supabase.from('achievements').select('*');
            // ユーザー獲得状況取得
            const { data: earned } = await supabase
                .from('user_achievements')
                .select('achievement_id, earned_at')
                .eq('user_id', userId);

            if (all) {
                const merged = all.map((ach) => ({
                    ...ach,
                    earned_at: earned?.find((e) => e.achievement_id === ach.id)?.earned_at,
                }));
                setAchievements(merged);
            }
        };
        fetchAchievements();
    }, [userId]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase">🏆 Achievements</h3>
            <div className="grid grid-cols-4 gap-2">
                {achievements.map((ach) => (
                    <div
                        key={ach.id}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg text-center transition group relative
              ${ach.earned_at ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100 opacity-50 grayscale'}
            `}
                    >
                        <span className="text-2xl mb-1">{ach.icon}</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-xs p-2 rounded w-32 z-10">
                            <p className="font-bold">{ach.title}</p>
                            <p className="opacity-80">{ach.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

