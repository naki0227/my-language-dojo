'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import VideoSearchModal from '@/components/VideoSearchModal';
import { useRouter } from 'next/navigation';
import { CheckCircle, RotateCw } from 'lucide-react';

type AdminComment = { id: number; user_id: string; username: string; content: string; video_id: string; created_at: string; likes: number; };
type Inquiry = { id: number; category: string; message: string; created_at: string; is_read: boolean; };
type Wordbook = { id: number; title: string; };

const SETUP_SUBJECTS = ['English', 'Spanish', 'French', 'Chinese', 'Korean', 'Portuguese', 'Arabic', 'Russian', 'Programming', 'Sign Language'];
const CEFR_LEVELS_SHORT = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function AdminPage() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'textbook' | 'comments' | 'daily' | 'inquiry' | 'roadmap' | 'setup'>('setup');

    // 各種ステート
    const [topic, setTopic] = useState('');
    const [category, setCategory] = useState('jhs');
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [selectedWordbook, setSelectedWordbook] = useState<string>('');
    const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
    const [dailyQuiz, setDailyQuiz] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [comments, setComments] = useState<AdminComment[]>([]);
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [roadmapLevel, setRoadmapLevel] = useState('A1');
    const [roadmapQuery, setRoadmapQuery] = useState('');

    // ★共通管理対象科目ステート
    const [currentAdminSubject, setCurrentAdminSubject] = useState('English');
    const [setupStep, setSetupStep] = useState(1);

    useEffect(() => {
        const checkPrivileges = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }
            const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
            if (profile && profile.is_admin) {
                setIsAdmin(true);
                fetchComments();
                fetchWordbooks();
                fetchInquiries();
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
        // ★修正: 現在の管理対象科目で単語帳リストをフィルタ
        const { data } = await supabase.from('wordbooks').select('id, title').eq('subject', currentAdminSubject);
        if (data) setWordbooks(data);
    };

    const fetchComments = async () => {
        // コメントは全件取得 (動画IDがない場合はテキストブックコメントと見なす)
        const { data } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(50);
        if (data) setComments(data);
    };

    const fetchInquiries = async () => {
        const { data } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });
        if (data) {
            setInquiries(data);
            setUnreadCount(data.filter((i: any) => !i.is_read).length);
        }
    };

    const markAsRead = async (id: number) => {
        await supabase.from('inquiries').update({ is_read: true }).eq('id', id);
        setInquiries(inquiries.map(i => i.id === id ? { ...i, is_read: true } : i));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const deleteComment = async (id: number) => {
        if (!confirm('削除しますか？')) return;
        await supabase.from('comments').delete().eq('id', id);
        setComments(comments.filter(c => c.id !== id));
    };

    // --- 教科書個別生成 ---
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/textbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, category, targetSubject: currentAdminSubject }), // ★言語を渡す
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // ... (タイトルと本文の整形ロジックは省略) ...
            const lines = data.content.split('\n');
            const titleLineIndex = lines.findIndex((line: string) => line.startsWith('# '));
            let rawTitle = '';
            let body = data.content;
            if (titleLineIndex !== -1) { rawTitle = lines[titleLineIndex].replace('# ', '').trim(); const bodyLines = lines.filter((_: string, i: number) => i !== titleLineIndex); body = bodyLines.join('\n').trim(); } else { rawTitle = data.generatedTopic || topic || 'Untitled'; }

            setTitle(rawTitle);
            setContent(body);
            if (!topic && data.generatedTopic) setTopic(data.generatedTopic);
        } catch (e) { alert('AI生成失敗'); }
        finally { setIsGenerating(false); }
    };

    // --- 日替わりAI選定 ---
    const handleAiDailyPick = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: currentAdminSubject }) // ★言語を渡す
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTopic(data.videoId); setContent(data.message); setDailyQuiz(data.quiz);
            alert(`AI選定完了！\nテーマ: ${data.topic}`);
        } catch (e) { alert('AI選定失敗'); }
        finally { setIsGenerating(false); }
    };

    // --- 日替わり保存 ---
    const handleSaveDaily = async () => {
        const { error } = await supabase.from('daily_picks').upsert([{
            date: new Date().toISOString().split('T')[0],
            video_id: topic, message: content, quiz_data: dailyQuiz,
            subject: currentAdminSubject // ★言語を保存
        }], { onConflict: 'date' });
        if (!error) alert('設定しました！'); else alert('エラー: ' + error.message);
    };

    // --- ロードマップ生成 ---
    const handleGenerateRoadmap = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/admin/roadmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: roadmapLevel, keywords: roadmapQuery, targetSubject: currentAdminSubject }), // ★言語を渡す
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            alert(`成功！ ${data.count}件の動画を ${currentAdminSubject} Lvl ${roadmapLevel} に追加しました。`);
        } catch (e: any) {
            alert('エラー: ' + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // --- 教科書個別保存 ---
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
        const insertData: any = { title: finalTitle, content, subject: currentAdminSubject }; // ★言語を保存
        if (selectedWordbook) insertData.related_wordbook_id = parseInt(selectedWordbook);
        const { error } = await supabase.from('textbooks').insert([insertData]);
        if (!error) { alert('保存しました！'); setTopic(''); setTitle(''); setContent(''); setSelectedWordbook(''); }
        else { alert('保存エラー'); }
        setIsSaving(false);
    };

    // --- 全自動セットアップ ---
    const runSetupStep = async (step: number) => {
        setIsGenerating(true);
        try {
            const endpoint = step === 1 ? '/api/admin/full_setup' : '/api/ai/textbook_bulk';
            const body = { subject: currentAdminSubject }; // ★言語を渡す

            const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("API returned non-JSON:", errorText);
                throw new Error(`API error (Status ${res.status}): See console for details.`);
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (step === 1) {
                alert(`✅ ステップ1完了！単語帳 ${data.words}語 / テスト問題 ${data.questions}問 を登録しました。`);
                setSetupStep(2);
            } else if (step === 2) {
                alert(`✅ ステップ2完了！教科書 ${data.textbooks}冊を生成・登録しました。`);
                setSetupStep(3);
            }

        } catch (e: any) {
            alert(`セットアップエラー: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };


    const insertVideo = (id: string) => {
        const tag = `\n[[video:${id}:0:動画タイトル]]\n`;
        setContent(prev => prev + tag);
    };

    // --- UIレンダリング ---
    if (isLoading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Checking...</div>;
    if (!isAdmin) return null;

    return (
        <main className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
            <div className="w-full max-w-6xl">
                {/* ヘッダー */}
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold flex items-center gap-3">⚡️ Admin Dashboard</h1>
                    <Link href="/" className="text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded">Exit</Link>
                </div>

                {/* ★管理対象言語セレクター (全タブ共通)★ */}
                <div className="mb-8 border-b border-gray-700 pb-4 flex items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-400">Manage Subject:</h3>
                    <select
                        value={currentAdminSubject}
                        onChange={(e) => {
                            setCurrentAdminSubject(e.target.value);
                            // 言語が変わったらロードマップ/教科書個別タブのステータスをリセット
                            setRoadmapQuery('');
                            setSetupStep(1);
                            fetchWordbooks(); // 紐付け単語帳リスト更新
                        }}
                        className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-white outline-none"
                    >
                        {SETUP_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* --- タブ切り替え --- */}
                <div className="flex gap-4 mb-8 border-b border-gray-700 pb-1 overflow-x-auto">
                    <button onClick={() => setActiveTab('setup')} className={`pb-2 px-4 font-bold transition whitespace-nowrap ${activeTab === 'setup' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}>🚀 セットアップ</button>
                    <button onClick={() => setActiveTab('textbook')} className={`pb-2 px-4 font-bold transition whitespace-nowrap ${activeTab === 'textbook' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500'}`}>📖 教科書 (個別)</button>
                    <button onClick={() => setActiveTab('roadmap')} className={`pb-2 px-4 font-bold transition whitespace-nowrap ${activeTab === 'roadmap' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>🗺️ ロードマップ</button>
                    <button onClick={() => setActiveTab('daily')} className={`pb-2 px-4 font-bold transition whitespace-nowrap ${activeTab === 'daily' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>📅 日替わり</button>
                    <button onClick={() => setActiveTab('comments')} className={`pb-2 px-4 font-bold transition whitespace-nowrap ${activeTab === 'comments' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500'}`}>💬 コメント</button>
                    <button onClick={() => setActiveTab('inquiry')} className={`pb-2 px-4 font-bold transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'inquiry' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}>
                        📮 受信箱 {unreadCount > 0 && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
                    </button>
                </div>

                {/* --- 1. 全自動セットアップ画面 --- */}
                {activeTab === 'setup' && (
                    <div className="bg-gray-800 p-8 rounded-xl border border-green-600 space-y-6 animate-fade-in">
                        <h2 className="font-bold text-2xl text-green-400 mb-4">🚀 New Subject Setup ({currentAdminSubject})</h2>
                        <div className="flex items-center gap-4">
                            {/* 言語セレクターは共通ヘッダーに移動しましたが、ステップ管理のためにここにロジックを残します */}
                        </div>

                        <div className="pt-4 border-t border-gray-700">
                            {setupStep === 1 && (
                                <button
                                    onClick={() => runSetupStep(1)}
                                    disabled={isGenerating}
                                    className={`w-full py-4 rounded-lg font-bold text-lg transition text-white
                    ${isGenerating ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'}`}
                                >
                                    {isGenerating ? <span className='flex items-center justify-center'><RotateCw className='w-5 h-5 mr-2 animate-spin' />STEP 1/2: Word & Test Generating...</span> : `1. 単語帳とテスト問題を作成`}
                                </button>
                            )}
                            {setupStep === 2 && (
                                <button
                                    onClick={() => runSetupStep(2)}
                                    disabled={isGenerating}
                                    className={`w-full py-4 rounded-lg font-bold text-lg transition text-white
                    ${isGenerating ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                                >
                                    {isGenerating ? <span className='flex items-center justify-center'><RotateCw className='w-5 h-5 mr-2 animate-spin' />STEP 2/2: Textbook Generating...</span> : `2. 基礎教科書を生成・登録`}
                                </button>
                            )}
                            {setupStep === 3 && (
                                <div className="text-center text-green-400 text-xl font-bold">
                                    <CheckCircle className='w-10 h-10 mx-auto mb-3' />
                                    ✅ セットアップ完了！{currentAdminSubject} の学習を始められます。
                                    <button onClick={() => setSetupStep(1)} className="mt-4 block w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded">再スタート</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- 2. 教科書個別生成画面 (言語別対応済み) --- */}
                {activeTab === 'textbook' && (
                    <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                        <div className="bg-gray-800 p-6 rounded-xl space-y-6 border border-gray-700">
                            <h2 className="font-bold text-xl text-blue-400">1. AI Generator ({currentAdminSubject})</h2>
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
                            <h2 className="font-bold text-xl text-green-400">2. Publish</h2>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full p-3 rounded bg-gray-900 border border-gray-600 font-bold" />
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">関連単語帳 ({currentAdminSubject})</label>
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

                {/* --- 3. ロードマップ管理画面 (言語別対応済み) --- */}
                {activeTab === 'roadmap' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in">
                        <h2 className="font-bold text-xl mb-4 text-purple-400">🗺️ Roadmap Auto-Generator ({currentAdminSubject})</h2>
                        <p className="text-gray-400 mb-6 text-sm">現在の管理対象：{currentAdminSubject}。この設定で動画が追加されます。</p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Target Level</label>
                                <select
                                    value={roadmapLevel}
                                    onChange={(e) => setRoadmapLevel(e.target.value)}
                                    className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none"
                                >
                                    {CEFR_LEVELS_SHORT.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Search Keywords (Optional)</label>
                                <input
                                    type="text"
                                    value={roadmapQuery}
                                    onChange={(e) => setRoadmapQuery(e.target.value)}
                                    placeholder={`空欄ならデフォルト (${currentAdminSubject} stories)`}
                                    className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none"
                                />
                            </div>

                            <button
                                onClick={handleGenerateRoadmap}
                                disabled={isGenerating}
                                className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transition ${isGenerating ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}
                            >
                                {isGenerating ? <span className='flex items-center justify-center'><RotateCw className='w-5 h-5 mr-2 animate-spin' />Generating...</span> : `🚀 Generate & Add Videos for Lvl ${roadmapLevel}`}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- 4. 日替わり設定画面 (言語別対応済み) --- */}
                {activeTab === 'daily' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in">
                        <h2 className="font-bold text-xl mb-4 text-yellow-400">📅 Today's Pick Configuration ({currentAdminSubject})</h2>
                        <div className="space-y-4">
                            <button onClick={handleAiDailyPick} disabled={isGenerating} className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg mb-4 flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-600' : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:opacity-90'}`}>
                                {isGenerating ? 'AI is thinking...' : '🤖 AI Auto-Select'}
                            </button>
                            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="YouTube ID" className="w-full p-3 rounded bg-gray-900 border border-gray-600" />
                            <input type="text" value={content} onChange={(e) => setContent(e.target.value)} placeholder="メッセージ" className="w-full p-3 rounded bg-gray-900 border border-gray-600" />
                            <button onClick={handleSaveDaily} className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded font-bold">Set as Today's Pick</button>
                        </div>
                    </div>
                )}

                {/* ... (他のタブは省略) ... */}
            </div>

            {isSearchOpen && <VideoSearchModal onClose={() => setIsSearchOpen(false)} onSelect={(id) => {
                if (activeTab === 'daily') setTopic(id);
                else insertVideo(id);
                setIsSearchOpen(false);
            }} />}
        </main>
    );
}

