'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type RoadmapItem = {
    id: number;
    step_order: number;
    video_id: string;
    title: string;
    description: string;
    is_completed: boolean; // 視聴済みか？
    subject: string; // 言語情報
};

type Props = {
    levelResult: string;
    userId: string;
    currentSubject: string; // ★現在の言語
};

export default function LearningRoadmap({ levelResult, userId, currentSubject }: Props) {
    const [items, setItems] = useState<RoadmapItem[]>([]);
    const [loading, setLoading] = useState(true);

    const levelCode = levelResult.split(' ')[0];

    useEffect(() => {
        const fetchRoadmap = async () => {
            setLoading(true);

            // 1. ロードマップデータを取得 (言語とレベルでフィルタリング)
            const { data: roadmapData } = await supabase
                .from('roadmap_items')
                .select('*')
                .eq('level_code', levelCode)
                .eq('subject', currentSubject) // ★フィルタリング
                .order('step_order', { ascending: true });

            if (!roadmapData || roadmapData.length === 0) {
                setItems([]);
                setLoading(false);
                return;
            }

            // 2. ユーザーの視聴履歴を取得 (この動画を見たことがあるか？)
            const videoIds = roadmapData.map(item => item.video_id);
            const { data: historyData } = await supabase
                .from('view_history')
                .select('target_id')
                .eq('user_id', userId)
                .eq('content_type', 'video')
                .in('target_id', videoIds);

            const watchedIds = new Set(historyData?.map(h => h.target_id) || []);

            // 3. データを結合
            const mergedItems = roadmapData.map(item => ({
                ...item,
                is_completed: watchedIds.has(item.video_id)
            }));

            setItems(mergedItems);
            setLoading(false);
        };

        fetchRoadmap();
    }, [levelCode, userId, currentSubject]); // ★依存配列にcurrentSubjectを追加

    if (loading) return <div className="p-4 text-center text-gray-400">Loading roadmap...</div>;
    if (items.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <span className="text-2xl">🗺️</span>
                <div>
                    <h3 className="font-bold text-gray-800">Learning Roadmap</h3>
                    <p className="text-xs text-gray-500 font-bold text-blue-600">Level: {levelCode} ({currentSubject})</p>
                </div>
            </div>

            <div className="space-y-4 relative">
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200 -z-10"></div>

                {items.map((item, index) => {
                    const isNext = !item.is_completed && (index === 0 || items[index - 1].is_completed);

                    return (
                        <div key={item.id} className={`relative flex gap-4 ${item.is_completed ? 'opacity-60' : 'opacity-100'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shrink-0 z-10 border-2 
                ${item.is_completed ? 'bg-green-500 border-green-500' : isNext ? 'bg-blue-600 border-blue-600 animate-pulse' : 'bg-white border-gray-300 text-gray-400'}
              `}>
                                {item.is_completed ? '✓' : item.step_order}
                            </div>

                            <div className={`flex-1 rounded-lg border p-3 transition 
                ${isNext ? 'bg-blue-50 border-blue-200 shadow-md transform scale-105' : 'bg-white border-gray-200'}
              `}>
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-gray-800">{item.title}</h4>
                                    {isNext && <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">NEXT</span>}
                                </div>
                                <p className="text-sm text-gray-600 mt-1 mb-2">{item.description}</p>

                                <Link
                                    href={`/?videoId=${item.video_id}`}
                                    className={`block text-center text-sm font-bold py-2 rounded 
                    ${isNext ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                  `}
                                >
                                    {item.is_completed ? '復習する (Watch Again)' : '学習する (Start)'}
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

