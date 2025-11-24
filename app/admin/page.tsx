'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import VideoSearchModal from '@/components/VideoSearchModal';
import { useRouter } from 'next/navigation';

type AdminComment = { id: number; user_id: string; username: string; content: string; video_id: string; created_at: string; likes: number; };
type Wordbook = { id: number; title: string; };

export default function AdminPage() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'textbook' | 'comments' | 'daily'>('textbook');

    // 教科書 & 日替わり用
    const [topic, setTopic] = useState('');
    const [category, setCategory] = useState('jhs');
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [selectedWordbook, setSelectedWordbook] = useState<string>('');
    const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // コメント管理用
    const [comments, setComments] = useState<AdminComment[]>([]);
    const [isCommentLoading, setIsCommentLoading] = useState(false);

    useEffect(() => {
        const checkPrivileges = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }
            const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
            if (profile && profile.is_admin) {
                setIsAdmin(true);
                fetchComments();
                fetchWordbooks();
            } else {
                alert('⛔️ 管理者権限がありません。');
                router.push('/');
            }
            setIsLoading(false);
        };
        checkPrivileges();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchWordbooks = async () => {
        const { data } = await supabase.from('wordbooks').select('id, title');
        if (data) setWordbooks(data);
    };

    const fetchComments = async () => {
        setIsCommentLoading(true);
        const { data } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(50);
        if (data) setComments(data);
        setIsCommentLoading(false);
    };

    const deleteComment = async (id: number) => {
        if (!confirm('削除しますか？')) return;
        await supabase.from('comments').delete().eq('id', id);
        setComments(comments.filter(c => c.id !== id));
    };

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
            if (!topic && data.generatedTopic) setTopic(data.generatedTopic);
        } catch (e) { alert('AI生成失敗'); }
        finally { setIsGenerating(false); }
    };

    // ★日替わりAI自動生成★
    const handleAiDailyPick = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/daily', { method: 'POST' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setTopic(data.videoId); // 動画ID
            setContent(data.message); // メッセージ
            alert(`AIが選定しました！\nテーマ: ${data.topic}`);
        } catch (e) {
            alert('AI選定に失敗しました');
        } finally {
            setIsGenerating(false);
        }
    };

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
        const insertData: any = { title: finalTitle, content };
        if (selectedWordbook) insertData.related_wordbook_id = parseInt(selectedWordbook);
        const { error } = await supabase.from('textbooks').insert([insertData]);
        if (!error) { alert('保存しました！'); setTopic(''); setTitle(''); setContent(''); setSelectedWordbook(''); }
        else { alert('保存エラー'); }
        setIsSaving(false);
    };

    const insertVideo = (id: string) => {
        const tag = `\n[[video:${id}:0:動画タイトル]]\n`;
        setContent(prev => prev + tag);
    };

    if (isLoading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Checking...</div>;
    if (!isAdmin) return null;

    return (
        <main className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
            <div className="w-full max-w-6xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">⚡️ Admin Dashboard</h1>
                    <Link href="/" className="text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded">Exit</Link>
                </div>

                <div className="flex gap-4 mb-8 border-b border-gray-700 pb-1">
                    <button onClick={() => setActiveTab('textbook')} className={`pb-2 px-4 font-bold transition ${activeTab === 'textbook' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>📖 教科書</button>
                    <button onClick={() => setActiveTab('comments')} className={`pb-2 px-4 font-bold transition ${activeTab === 'comments' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>💬 コメント</button>
                    <button onClick={() => setActiveTab('daily')} className={`pb-2 px-4 font-bold transition ${activeTab === 'daily' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}>📅 日替わり設定</button>
                </div>

                {activeTab === 'textbook' && (
                    <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                        <div className="bg-gray-800 p-6 rounded-xl space-y-6 border border-gray-700">
                            <h2 className="font-bold text-xl text-blue-400">1. AI Generator</h2>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Category</label>
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none">
                                    <option value="jhs">中学英語</option>
                                    <option value="hs">高校英語</option>
                                    <option value="business">ビジネス</option>
                                    <option value="eiken">英検</option>
                                    <option value="column">コラム</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Topic</label>
                                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="空欄ならAIが決定" className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none" />
                            </div>
                            <button onClick={handleGenerate} disabled={isGenerating} className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transition ${isGenerating ? 'opacity-50' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                {isGenerating ? 'Thinking...' : '🎲 テーマおまかせ生成'}
                            </button>
                        </div>

                        <div className="bg-gray-800 p-6 rounded-xl space-y-4 flex flex-col border border-gray-700">
                            <h2 className="font-bold text-xl text-green-400 mb-2">2. Publish</h2>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full p-3 rounded bg-gray-900 border border-gray-600 font-bold" />
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">関連単語帳</label>
                                <select value={selectedWordbook} onChange={(e) => setSelectedWordbook(e.target.value)} className="w-full p-2 rounded bg-gray-900 border border-gray-600 text-sm">
                                    <option value="">なし</option>
                                    {wordbooks.map(wb => (<option key={wb.id} value={wb.id}>{wb.title}</option>))}
                                </select>
                            </div>
                            <div className="relative flex-1 min-h-[300px]">
                                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content..." className="w-full h-full p-3 rounded bg-gray-900 border border-gray-600 font-mono text-sm resize-none" />
                                <button onClick={() => setIsSearchOpen(true)} className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-xs font-bold shadow-lg">📺 動画追加</button>
                            </div>
                            <button onClick={handleSave} disabled={isSaving || !title} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold shadow-lg disabled:opacity-50">🚀 Publish</button>
                        </div>
                    </div>
                )}

                {activeTab === 'comments' && (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden p-4">
                        <div className="divide-y divide-gray-700 max-h-[70vh] overflow-y-auto">
                            {comments.map(c => (
                                <div key={c.id} className="p-4 flex justify-between">
                                    <div><span className="text-blue-400 font-bold">{c.username}</span>: {c.content}</div>
                                    <button onClick={() => deleteComment(c.id)} className="text-red-400 hover:text-red-200">Delete</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- 日替わり設定画面 --- */}
                {activeTab === 'daily' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in">
                        <h2 className="font-bold text-xl mb-4 text-yellow-400">📅 Today's Pick Configuration</h2>
                        <div className="space-y-4">
                            <button
                                onClick={handleAiDailyPick}
                                disabled={isGenerating}
                                className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg mb-4 flex items-center justify-center gap-2
                  ${isGenerating ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:opacity-90'}`}
                            >
                                {isGenerating ? 'AI is thinking...' : '🤖 AI Auto-Select (Today\'s Theme)'}
                            </button>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Today's Video ID</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={topic} // 動画IDとして使用
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="YouTube ID"
                                        className="flex-1 p-3 rounded bg-gray-900 border border-gray-600"
                                    />
                                    <button onClick={() => setIsSearchOpen(true)} className="bg-blue-600 px-4 rounded font-bold">検索</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Message</label>
                                <input
                                    type="text"
                                    value={content} // メッセージとして使用
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="今日のひとこと"
                                    className="w-full p-3 rounded bg-gray-900 border border-gray-600"
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    const { error } = await supabase.from('daily_picks').upsert([{
                                        date: new Date().toISOString().split('T')[0],
                                        video_id: topic,
                                        message: content
                                    }], { onConflict: 'date' });
                                    if (!error) alert('設定しました！');
                                    else alert('エラー: ' + error.message);
                                }}
                                className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded font-bold"
                            >
                                Set as Today's Pick
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {isSearchOpen && <VideoSearchModal onClose={() => setIsSearchOpen(false)} onSelect={(id) => {
                if (activeTab === 'daily') setTopic(id);
                else insertVideo(id);
                setIsSearchOpen(false);
            }} />}
        </main>
    );
}


