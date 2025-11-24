'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function StudyStats({ userId }: { userId: string }) {
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        const fetchStats = async () => {
            // 直近7日間のデータを取得
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);

            const { data: logs } = await supabase
                .from('study_logs')
                .select('date, count')
                .eq('user_id', userId)
                .gte('date', startDate.toISOString().split('T')[0])
                .lte('date', endDate.toISOString().split('T')[0])
                .order('date', { ascending: true });

            // グラフ用にデータを整形（データがない日も埋める）
            const chartData = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const log = logs?.find((l) => l.date === dateStr);
                chartData.push({
                    name: d.toLocaleDateString('ja-JP', { weekday: 'short' }), // 月, 火...
                    count: log ? log.count : 0,
                });
            }
            setData(chartData);
        };
        fetchStats();
    }, [userId]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-64">
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase">📊 Weekly Activity</h3>
            <ResponsiveContainer width="100%" height="80%">
                <BarChart data={data}>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#4F46E5' : '#E5E7EB'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

