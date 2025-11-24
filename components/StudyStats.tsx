'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#FF8042', '#00C49F', '#FFBB28']; // 色の配列

export default function StudyStats({ userId }: { userId: string }) {
    const [data, setData] = useState<any[]>([]);
    const [totalXp, setTotalXp] = useState(0);

    useEffect(() => {
        const fetchStats = async () => {
            // user_levels テーブルから、各言語のXPを取得
            const { data: levels } = await supabase
                .from('user_levels')
                .select('subject, xp')
                .eq('user_id', userId)
                .gt('xp', 0); // XPが0より大きいものだけ

            if (levels && levels.length > 0) {
                // グラフ用にデータを整形
                const chartData = levels.map((level) => ({
                    name: level.subject,
                    value: level.xp,
                }));
                setData(chartData);
                setTotalXp(chartData.reduce((sum, item) => sum + item.value, 0));
            } else {
                setData([]);
                setTotalXp(0);
            }
        };
        fetchStats();
    }, [userId]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase">🌍 Subject XP Distribution</h3>
            {data.length > 0 ? (
                <>
                    <div className="text-center mb-2">
                        <span className="text-2xl font-bold text-gray-800">{totalXp} XP</span>
                        <span className="text-sm text-gray-500 block">Total Experience Earned</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                labelLine={false}
                                paddingAngle={2}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number, name: string) => [`${value} XP`, name]}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </>
            ) : (
                <div className="text-center pt-10 text-gray-400 text-sm">No XP earned yet. Start learning!</div>
            )}
        </div>
    );
}