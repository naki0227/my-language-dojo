'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Heatmap({ userId }: { userId: string }) {
    const [logs, setLogs] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchLogs = async () => {
            const { data } = await supabase
                .from('study_logs')
                .select('date, count')
                .eq('user_id', userId)
                .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // 過去30日

            const logMap: Record<string, number> = {};
            data?.forEach((log: any) => {
                logMap[log.date] = log.count;
            });
            setLogs(logMap);
        };
        if (userId) fetchLogs();
    }, [userId]);

    // 過去28日分の日付を生成
    const days = Array.from({ length: 28 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (27 - i));
        return d.toISOString().split('T')[0];
    });

    const getColor = (count: number) => {
        if (!count) return 'bg-gray-200';
        if (count >= 10) return 'bg-green-600';
        if (count >= 5) return 'bg-green-400';
        return 'bg-green-200';
    };

    return (
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">Study Consistency</h3>
            <div className="flex gap-1 overflow-x-auto pb-2">
                {days.map((date) => (
                    <div key={date} className="flex flex-col items-center gap-1">
                        <div
                            className={`w-3 h-3 md:w-4 md:h-4 rounded-sm ${getColor(logs[date] || 0)}`}
                            title={`${date}: ${logs[date] || 0} activities`}
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-end items-center gap-2 text-[10px] text-gray-400">
                <span>Less</span>
                <div className="w-2 h-2 bg-gray-200 rounded-sm"></div>
                <div className="w-2 h-2 bg-green-200 rounded-sm"></div>
                <div className="w-2 h-2 bg-green-400 rounded-sm"></div>
                <div className="w-2 h-2 bg-green-600 rounded-sm"></div>
                <span>More</span>
            </div>
        </div>
    );
}
