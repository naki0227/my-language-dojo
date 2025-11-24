'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import VideoSearchModal from '@/components/VideoSearchModal';
import { useRouter } from 'next/navigation'; // ルーターを追加

export default function AdminPage() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false); // 管理者かどうか
    const [isLoading, setIsLoading] = useState(true); // チェック中かどうか

    // 生成・編集用ステート
    const [topic, setTopic] = useState('');
    const [category, setCategory] = useState('jhs');
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // --- 🔐 セキュリティチェック ---
    useEffect(() => {
        const checkPrivileges = async () => {
            // 1. ログインしてる？
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/auth'); // ログインしてないならログイン画面へ
                return;
            }

            // 2. 管理者権限持ってる？
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.is_admin) {
                setIsAdmin(true); // 合格！
            } else {
                alert('⛔️ 管理者権限がありません。トップページに戻ります。');
                router.push('/'); // 不合格なら強制送還
            }
            setIsLoading(false);
        };

        checkPrivileges();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- AI生成ロジック ---
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/textbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, category }),
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            const lines = data.content.split('\n');
            const titleLineIndex = lines.findIndex((line: string) => line.startsWith('# '));

            let rawTitle = '';
            let body = data.content;

            if (titleLineIndex !== -1) {
                rawTitle = lines[titleLineIndex].replace('# ', '').trim();
                const bodyLines = lines.filter((_: string, i: number) => i !== titleLineIndex);
                body = bodyLines.join('\n').trim();
            } else {
                rawTitle = data.generatedTopic || topic || 'Untitled';
            }

            setTitle(rawTitle);
            setContent(body);

            if (!topic && data.generatedTopic) {
                setTopic(data.generatedTopic);
            }

        } catch (e) {
            alert('AI生成に失敗しました');
        } finally {
            setIsGenerating(false);
        }
    };

    // --- 保存ロジック ---
    const handleSave = async () => {
        if (!title || !content) return;
        setIsSaving(true);

        let categoryBadge = '';
        if (category === 'jhs') categoryBadge = '中学英語';
        if (category === 'hs') categoryBadge = '高校英語';
        if (category === 'business') categoryBadge = 'ビジネス';
        if (category === 'eiken') categoryBadge = '英検';
        if (category === 'column') categoryBadge = 'コラム';

        const finalTitle = title.includes('【') ? title : (categoryBadge ? `【${categoryBadge}】 ${title}` : title);

        const { error } = await supabase
            .from('textbooks')
            .insert([{ title: finalTitle, content }]);

        if (!error) {
            alert('保存しました！');
            setTopic('');
            setTitle('');
            setContent('');
        } else {
            alert('保存エラー: ' + error.message);
        }
        setIsSaving(false);
    };

    const insertVideo = (id: string) => {
        const tag = `\n[[video:${id}:0:動画タイトル]]\n`;
        setContent(prev => prev + tag);
    };

    // --- レンダリング ---
    // チェック中はローディング画面を出す（中身を見せない）
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl font-bold animate-pulse">🔐 Checking privileges...</div>
            </div>
        );
    }

    // 管理者じゃないなら何も表示しない（useEffectでリダイレクトされるまでのチラつき防止）
    if (!isAdmin) return null;

    return (
        <main className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        ⚡️ Admin Dashboard <span className="text-xs bg-red-600 px-2 py-1 rounded text-white">Secret</span>
                    </h1>
                    <Link href="/" className="text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded">Exit</Link>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* 左側: 生成パネル */}
                    <div className="bg-gray-800 p-6 rounded-xl space-y-6 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-xl text-blue-400">1. AI Generator</h2>
                            <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">Gemini 2.5 Pro</span>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Target Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 focus:border-blue-500 outline-none"
                            >
                                <option value="jhs">中学英語 (JHS)</option>
                                <option value="hs">高校英語 (HS)</option>
                                <option value="business">ビジネス (Business)</option>
                                <option value="eiken">英検 (Eiken)</option>
                                <option value="column">コラム (Column)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">
                                Topic <span className="text-xs text-gray-500">(Empty = Auto)</span>
                            </label>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="空欄ならAIが勝手に決めます"
                                className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transition flex items-center justify-center gap-2
                ${!topic
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90'
                                    : 'bg-blue-600 hover:bg-blue-500'}
                ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                        >
                            {isGenerating ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                            ) : !topic ? (
                                <><span>🎲</span> テーマおまかせ生成</>
                            ) : (
                                <><span>🤖</span> このテーマで書く</>
                            )}
                        </button>

                        {!topic && (
                            <p className="text-center text-xs text-gray-500">
                                カテゴリに合った面白いテーマをAIが提案・執筆します
                            </p>
                        )}
                    </div>

                    {/* 右側: 編集・保存パネル */}
                    <div className="bg-gray-800 p-6 rounded-xl space-y-4 flex flex-col border border-gray-700">
                        <h2 className="font-bold text-xl text-green-400 mb-2">2. Review & Publish</h2>

                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Title (Auto generated)"
                            className="w-full p-3 rounded bg-gray-900 border border-gray-600 font-bold"
                        />

                        <div className="relative flex-1 min-h-[300px]">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Markdown content will appear here..."
                                className="w-full h-full p-3 rounded bg-gray-900 border border-gray-600 font-mono text-sm leading-relaxed resize-none"
                            />
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-xs font-bold shadow-lg flex items-center gap-1"
                            >
                                <span>📺</span> 動画を追加
                            </button>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving || !title}
                            className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {isSaving ? 'Saving...' : '🚀 Publish to App'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 動画検索モーダル */}
            {isSearchOpen && (
                <VideoSearchModal
                    onClose={() => setIsSearchOpen(false)}
                    onSelect={(id) => {
                        insertVideo(id);
                        setIsSearchOpen(false);
                    }}
                />
            )}
        </main>
    );
}


