'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import VideoSearchModal from '@/components/VideoSearchModal';
import { useRouter } from 'next/navigation';
import { CheckCircle, RotateCw, BookOpen, Map, Calendar, MessageSquare, Mail, Rocket, Database, Search, PlayCircle, Save, Factory, Book, StopCircle, Clipboard, FileText } from 'lucide-react';
import { SETUP_SUBJECTS } from '@/lib/constants';

// カテゴリ定義
const CATEGORY_MAP: Record<string, { value: string; label: string }[]> = {
    'English': [{ value: 'grammar', label: '文法' }, { value: 'business', label: 'ビジネス' }, { value: 'conversation', label: '日常会話' }],
    'default': [{ value: 'grammar', label: '基礎' }, { value: 'conversation', label: '会話' }, { value: 'culture', label: '文化・コラム' }]
};

const CEFR_LEVELS_SHORT = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

type AdminComment = { id: number; user_id: string; username: string; content: string; video_id: string; created_at: string; likes: number; };
type Inquiry = { id: number; category: string; message: string; created_at: string; is_read: boolean; };
type Wordbook = { id: number; title: string; };
type MissingVideo = { id: string; title: string; source: string; };
type FoundVideo = { videoId: string; title: string; thumbnail: string; status?: 'waiting' | 'saving' | 'done' | 'error'; };

export default function AdminPage() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'textbook' | 'comments' | 'daily' | 'inquiry' | 'roadmap' | 'setup' | 'batch' | 'finder' | 'factory' | 'reading' | 'rawdata_import'>('setup');

    const [currentAdminSubject, setCurrentAdminSubject] = useState('English');
    const isCanceledRef = useRef(false);

    // --- 各種ステート ---

    // Raw Data Import
    const [importVideoId, setImportVideoId] = useState('');
    const [rawJsonInput, setRawJsonInput] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importLog, setImportLog] = useState('');

    // Finder
    const [finderMode, setFinderMode] = useState<'id' | 'keyword' | 'auto'>('keyword');
    const [finderInput, setFinderInput] = useState('');
    const [foundVideos, setFoundVideos] = useState<FoundVideo[]>([]);
    const [finderMessage, setFinderMessage] = useState('');

    // Batch
    const [missingVideos, setMissingVideos] = useState<MissingVideo[]>([]);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    const [processLog, setProcessLog] = useState<string[]>([]);
    const [missingIdsString, setMissingIdsString] = useState('');

    // Factory
    const [factoryTarget, setFactoryTarget] = useState<'all' | 'single'>('single');
    const [factoryContentType, setFactoryContentType] = useState<'wordbook' | 'textbook' | 'drill'>('wordbook');
    const [factoryCount, setFactoryCount] = useState(10);
    const [factoryLogs, setFactoryLogs] = useState<string[]>([]);
    const [factoryProgress, setFactoryProgress] = useState(0);

    // Textbook & Others
    const [topic, setTopic] = useState('');
    const [category, setCategory] = useState('');
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [selectedWordbook, setSelectedWordbook] = useState<string>('');
    const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);

    // Roadmap & Daily
    const [roadmapLevel, setRoadmapLevel] = useState('A1');
    const [roadmapQuery, setRoadmapQuery] = useState('');
    const [dailyQuiz, setDailyQuiz] = useState<any>(null);

    // Setup
    const [setupStep, setSetupStep] = useState(1);

    // Reading
    const [readingTopic, setReadingTopic] = useState('');
    const [readingCategory, setReadingCategory] = useState('novel');
    const [readingLevel, setReadingLevel] = useState('B1');

    // Common
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [comments, setComments] = useState<AdminComment[]>([]);
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);


    // --- データ取得 & 初期化 ---
    useEffect(() => {
        const options = CATEGORY_MAP[currentAdminSubject] || CATEGORY_MAP['default'];
        setCategory(options[0].value);
        if (isAdmin) fetchWordbooks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAdminSubject, isAdmin]);

    useEffect(() => {
        const checkPrivileges = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/auth'); return; }
            const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
            if (profile && profile.is_admin) {
                setIsAdmin(true);
                fetchComments();
                fetchInquiries();
                fetchWordbooks();
                fetchMissingVideos();
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
        const { data } = await supabase.from('wordbooks').select('id, title').eq('subject', currentAdminSubject);
        if (data) setWordbooks(data);
    };
    const fetchComments = async () => {
        const { data } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(50);
        if (data) setComments(data);
    };
    const fetchInquiries = async () => {
        const { data } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });
        if (data) { setInquiries(data); setUnreadCount(data.filter((i: any) => !i.is_read).length); }
    };
    const fetchMissingVideos = async () => {
        const res = await fetch('/api/admin/missing_transcripts');
        const data = await res.json();
        if (data.videos) {
            setMissingVideos(data.videos);
            const ids = data.videos.map((v: any) => v.id).join(' ');
            setMissingIdsString(ids);
        }
    };

    // --- 停止関数 ---
    const cancelProcessing = () => {
        isCanceledRef.current = true;
        setIsGenerating(false);
        setProcessLog(prev => [`🛑 CANCELED by User.`, ...prev]);
        alert('処理を中断しました。');
    };

    // ==========================================
    // 機能ロジック群
    // ==========================================

    // --- 0. Raw Data Import (手動インポート) ---
    const handleFormatSave = async () => {
        if (!importVideoId || !rawJsonInput) {
            setImportLog('Error: Video ID and JSON content are required.');
            return;
        }
        setIsImporting(true);
        setImportLog('⏳ Starting format and save...');

        try {
            let parsedJson;
            try {
                // JSONが有効かチェックし、文字列をオブジェクトに変換
                parsedJson = JSON.parse(rawJsonInput.trim());
                if (!Array.isArray(parsedJson)) throw new Error('Input must be a JSON array.');
            } catch (e: any) {
                setImportLog('❌ JSON Parse Error: Input is not a valid JSON Array.');
                setIsImporting(false);
                return;
            }

            // AI整形APIに生データをPOST
            const res = await fetch('/api/transcript/format_only', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: importVideoId, rawLines: parsedJson }),
            });

            if (!res.ok) {
                const errorBody = await res.json();
                throw new Error(errorBody.error || `Status ${res.status}`);
            }

            const data = await res.json();

            setImportLog(`✅ Success: ${data.count} lines formatted and saved to optimized_transcripts.`);
            setRawJsonInput('');
            setImportVideoId('');
            fetchMissingVideos(); // リストを更新

        } catch (e: any) {
            setImportLog(`❌ Fatal Error during processing: ${e.message}`);
        } finally {
            setIsImporting(false);
        }
    };


    // --- 1. 動画検索 (Finder) ---
    const handleFindVideo = async () => {
        if (finderMode !== 'auto' && !finderInput) return;
        setIsGenerating(true);
        setFoundVideos([]);
        setFinderMessage('');
        try {
            const res = await fetch('/api/admin/find_video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: finderMode, value: finderInput, subject: currentAdminSubject })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setFoundVideos(data.videos.map((v: any) => ({ ...v, status: 'waiting' })));
            setFinderMessage(data.message);
        } catch (e: any) { alert('検索失敗: ' + e.message); } finally { setIsGenerating(false); }
    };

    const handleSaveAllFoundVideos = async () => {
        if (foundVideos.length === 0) return;
        if (!confirm(`${foundVideos.length}件の動画の字幕を生成・保存しますか？`)) return;
        setIsGenerating(true);
        const newVideos = [...foundVideos];

        for (let i = 0; i < newVideos.length; i++) {
            newVideos[i].status = 'saving'; setFoundVideos([...newVideos]);
            try {
                await supabase.from('library_videos').upsert({ video_id: newVideos[i].videoId, title: newVideos[i].title, thumbnail_url: newVideos[i].thumbnail, user_id: (await supabase.auth.getSession()).data.session?.user.id });
                const res = await fetch(`/api/transcript?videoId=${newVideos[i].videoId}&lang=en`);
                if (res.ok) newVideos[i].status = 'done'; else newVideos[i].status = 'error';
            } catch (e) { newVideos[i].status = 'error'; }
            setFoundVideos([...newVideos]); await new Promise(r => setTimeout(r, 1000));
        }
        setIsGenerating(false); alert('一括保存が完了しました！');
    };

    // --- 2. バッチ処理 (Batch) ---
    const runBatchProcess = async () => {
        if (missingVideos.length === 0) return;
        if (!confirm(`${missingVideos.length}件の動画の字幕データを取得・整形しますか？`)) return;
        isCanceledRef.current = false;
        setIsGenerating(true); setProcessLog([]);
        let totalSuccess = 0;
        const totalVideos = missingVideos.length;

        for (let i = 0; i < totalVideos; i++) {
            if (isCanceledRef.current) break;
            setProcessingIndex(i); const video = missingVideos[i];
            const startTime = Date.now();
            setProcessLog(prev => [`⏳ Processing (${i + 1}/${totalVideos}): ${video.title}...`, ...prev]);
            try {
                const res = await fetch(`/api/transcript?videoId=${video.id}&lang=en`);
                const duration = (Date.now() - startTime) / 1000;
                if (res.ok) { totalSuccess++; setProcessLog(prev => [`✅ Success (${video.id}) [Time: ${duration.toFixed(1)}s]`, ...prev]); }
                else {
                    const errorText = await res.text();
                    setProcessLog(prev => [`❌ Failed (Status ${res.status}): ${video.id} [${errorText.substring(0, 50)}]`, ...prev]);
                }
            } catch (e) { setProcessLog(prev => [`❌ Fatal Error: ${e}`, ...prev]); }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        setIsGenerating(false); setProcessingIndex(null);
        if (!isCanceledRef.current) {
            setProcessLog(prev => [`\n--- FINISHED ---`, `🎉 Batch Complete: ${totalSuccess}/${totalVideos} videos processed.`, ...prev]);
        }
        fetchMissingVideos();
    };

    // --- 3. コンテンツ量産 (Factory) ---
    const runContentFactory = async () => {
        const subjects = factoryTarget === 'all' ? SETUP_SUBJECTS : [currentAdminSubject];
        const types = [factoryContentType];
        const levels = CEFR_LEVELS_SHORT;
        const totalTasks = subjects.length * types.length * levels.length * factoryCount;
        let completed = 0;

        if (!confirm(`合計 ${totalTasks} 個のコンテンツを生成します。\nタイプ: ${factoryContentType}\n時間がかかりますがよろしいですか？`)) return;

        setIsGenerating(true);
        setFactoryLogs([]);

        for (const sub of subjects) {
            for (const type of types) {
                for (const lvl of levels) {
                    for (let i = 0; i < factoryCount; i++) {
                        const label = `${sub} [${lvl}] ${type} (${i + 1}/${factoryCount})`;
                        setFactoryLogs(prev => [`⏳ Generating: ${label}...`, ...prev]);
                        try {
                            const res = await fetch('/api/admin/generate_single_content', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ subject: sub, level: lvl, type: type })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                setFactoryLogs(prev => [`✅ Created: ${data.title}`, ...prev]);
                            } else {
                                const errorText = await res.text();
                                setFactoryLogs(prev => [`❌ Error: ${label} (${errorText.substring(0, 50)}...)`, ...prev]);
                            }
                        } catch (e) { setFactoryLogs(prev => [`❌ Network Error: ${label}`, ...prev]); }
                        completed++;
                        setFactoryProgress(Math.round((completed / totalTasks) * 100));
                        const waitTime = type === 'textbook' ? 4000 : 2000;
                        await new Promise(r => setTimeout(r, waitTime));
                    }
                }
            }
        }
        setIsGenerating(false);
        alert('全工程が完了しました！');
    };

    // --- 4. セットアップ ---
    const runSetupStep = async (step: number) => {
        setIsGenerating(true);
        try {
            const endpoint = step === 1 ? '/api/admin/full_setup' : '/api/ai/textbook_bulk';
            const body = { subject: currentAdminSubject };
            const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'API Error');
            if (step === 1) { alert(`ステップ1完了`); setSetupStep(2); } else if (step === 2) { alert(`ステップ2完了`); setSetupStep(3); }
        } catch (e: any) { alert(`セットアップエラー: ${e.message}`); } finally { setIsGenerating(false); }
    };

    // --- 5. 教科書個別生成 ---
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/textbook', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, category, targetSubject: currentAdminSubject }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const lines = data.content.split('\n');
            const titleLineIndex = lines.findIndex((line: string) => line.startsWith('# '));
            let rawTitle = ''; let body = data.content;
            if (titleLineIndex !== -1) { rawTitle = lines[titleLineIndex].replace('# ', '').trim(); const bodyLines = lines.filter((_: string, i: number) => i !== titleLineIndex); body = bodyLines.join('\n').trim(); } else { rawTitle = data.generatedTopic || topic || 'Untitled'; }
            setTitle(rawTitle); setContent(body);
            if (!topic && data.generatedTopic) setTopic(data.generatedTopic);
        } catch (e: any) { alert('AI生成失敗: ' + e.message); } finally { setIsGenerating(false); }
    };

    const handleSave = async () => {
        if (!title || !content) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/ai/textbook/save', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, subject: currentAdminSubject, category }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            alert(`保存しました！\n教科書: ${data.title}`);
            setTopic(''); setTitle(''); setContent('');
        } catch (e: any) { alert('保存エラー: ' + e.message); } finally { setIsSaving(false); }
    };

    // --- 6. 読み物生成 ---
    const handleGenerateReading = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/reading', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: currentAdminSubject, level: readingLevel, category: readingCategory, topic: readingTopic })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            alert(`作成しました！: ${data.title}`);
            setReadingTopic('');
        } catch (e: any) { alert('エラー: ' + e.message); } finally { setIsGenerating(false); }
    };

    // --- 7. ロードマップ生成 ---
    const handleGenerateRoadmap = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/admin/roadmap', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: roadmapLevel, keywords: roadmapQuery, targetSubject: currentAdminSubject }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            alert(`成功！ ${data.count}件の動画を追加しました。`);
        } catch (e: any) { alert('エラー: ' + e.message); } finally { setIsGenerating(false); }
    };

    // --- 8. 日替わり ---
    const handleAiDailyPick = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: currentAdminSubject }) });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTopic(data.videoId); setContent(data.message); setDailyQuiz(data.quiz);
            alert(`AI選定完了！\nテーマ: ${data.topic}`);
        } catch (e) { alert('AI選定失敗'); } finally { setIsGenerating(false); }
    };
    const handleSaveDaily = async () => { const { error } = await supabase.from('daily_picks').upsert([{ date: new Date().toISOString().split('T')[0], video_id: topic, message: content, quiz_data: dailyQuiz, subject: currentAdminSubject }], { onConflict: 'date' }); if (!error) alert('設定しました！'); else alert('エラー: ' + error.message); };

    const insertVideo = (id: string) => { const tag = `\n[[video:${id}:0:動画タイトル]]\n`; setContent(prev => prev + tag); };

    const markAsRead = async (id: number) => { await supabase.from('inquiries').update({ is_read: true }).eq('id', id); setInquiries(inquiries.map(i => i.id === id ? { ...i, is_read: true } : i)); setUnreadCount(prev => Math.max(0, prev - 1)); };
    const deleteComment = async (id: number) => { if (!confirm('削除しますか？')) return; await supabase.from('comments').delete().eq('id', id); setComments(comments.filter(c => c.id !== id)); };

    if (isLoading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Checking...</div>;
    if (!isAdmin) return null;

    const categoryOptions = CATEGORY_MAP[currentAdminSubject] || CATEGORY_MAP['default'];

    return (
        <main className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
            <div className="w-full max-w-6xl">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold flex items-center gap-3">⚡️ Admin Dashboard</h1>
                    <Link href="/" className="text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded">Exit</Link>
                </div>

                <div className="mb-8 border-b border-gray-700 pb-4 flex items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-400">Target Subject:</h3>
                    <select value={currentAdminSubject} onChange={(e) => { setCurrentAdminSubject(e.target.value); setSetupStep(1); fetchWordbooks(); }} className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-white outline-none">
                        {SETUP_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="flex gap-4 mb-8 border-b border-gray-700 pb-1 overflow-x-auto">
                    <button onClick={() => setActiveTab('rawdata_import')} className={`pb-2 px-4 font-bold whitespace-nowrap flex items-center gap-2 ${activeTab === 'rawdata_import' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}><FileText size={18} /> 生字幕インポート</button>
                    <button onClick={() => setActiveTab('finder')} className={`pb-2 px-4 font-bold whitespace-nowrap flex items-center gap-2 ${activeTab === 'finder' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-500'}`}><Search size={18} /> 動画追加</button>
                    <button onClick={() => setActiveTab('batch')} className={`pb-2 px-4 font-bold whitespace-nowrap flex items-center gap-2 ${activeTab === 'batch' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500'}`}><Database size={18} /> 字幕DB</button>
                    <button onClick={() => setActiveTab('factory')} className={`pb-2 px-4 font-bold whitespace-nowrap flex items-center gap-2 ${activeTab === 'factory' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-gray-500'}`}><Factory size={18} /> 量産</button>
                    <button onClick={() => setActiveTab('setup')} className={`pb-2 px-4 font-bold whitespace-nowrap ${activeTab === 'setup' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}>🚀 セットアップ</button>
                    <button onClick={() => setActiveTab('textbook')} className={`pb-2 px-4 font-bold whitespace-nowrap ${activeTab === 'textbook' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500'}`}>📖 教科書</button>
                    <button onClick={() => setActiveTab('reading')} className={`pb-2 px-4 font-bold whitespace-nowrap flex items-center gap-2 ${activeTab === 'reading' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'}`}><Book size={18} /> 読み物</button>
                    <button onClick={() => setActiveTab('roadmap')} className={`pb-2 px-4 font-bold whitespace-nowrap ${activeTab === 'roadmap' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}>🗺️ ロードマップ</button>
                    <button onClick={() => setActiveTab('daily')} className={`pb-2 px-4 font-bold whitespace-nowrap ${activeTab === 'daily' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>📅 日替わり</button>
                    <button onClick={() => setActiveTab('comments')} className={`pb-2 px-4 font-bold whitespace-nowrap ${activeTab === 'comments' ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500'}`}>💬 コメント</button>
                    <button onClick={() => setActiveTab('inquiry')} className={`pb-2 px-4 font-bold whitespace-nowrap flex items-center gap-2 ${activeTab === 'inquiry' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}>
                        📮 受信箱 {unreadCount > 0 && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
                    </button>
                </div>

                {/* --- 0. Raw Data Manager (手動インポート) --- */}
                {activeTab === 'rawdata_import' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-green-500 space-y-4 animate-fade-in max-w-2xl mx-auto">
                        <h2 className="font-bold text-xl mb-4 text-green-400 flex items-center gap-2"><FileText /> 生字幕インポート & 整形</h2>
                        <p className="text-gray-400 text-sm">
                            **外部ツールで取得した生JSONデータ**を貼り付けてください。AIが整形処理を行い、マスターデータ（`optimized_transcripts`）としてDBに保存します。
                        </p>

                        <input type="text" value={importVideoId} onChange={(e) => setImportVideoId(e.target.value)} placeholder="1. YouTube Video ID" className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none" />

                        <textarea
                            value={rawJsonInput}
                            onChange={(e) => setRawJsonInput(e.target.value)}
                            placeholder={'2. Raw JSON Transcript Data (e.g., [{"text":"so in", "offset":1000, "duration":500}, ...])'}
                            rows={10}
                            className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 font-mono text-xs outline-none"
                        />

                        <button
                            onClick={handleFormatSave}
                            disabled={isImporting || !importVideoId || !rawJsonInput}
                            className={`w-full py-3 rounded-lg font-bold text-lg transition ${isImporting ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                        >
                            {isImporting ? <><RotateCw className="animate-spin mr-2" /> Processing...</> : '🚀 3. AI整形 & DB保存'}
                        </button>

                        <div className="bg-black rounded-lg p-3 h-20 overflow-y-auto font-mono text-xs border border-gray-700">
                            <p className={importLog.includes('Error') || importLog.includes('失敗') ? 'text-red-400' : 'text-green-400'}>{importLog || 'Status: Waiting for input...'}</p>
                        </div>
                    </div>
                )}

                {/* --- 1. 動画追加 (Finder) --- */}
                {activeTab === 'finder' && (
                    <div className="bg-gray-800 p-8 rounded-xl border border-orange-500 space-y-6 animate-fade-in">
                        <h2 className="font-bold text-2xl text-orange-400 mb-4 flex items-center gap-2"><PlayCircle /> 動画を追加・保存 ({currentAdminSubject})</h2>
                        <div className="flex gap-4 text-sm mb-4"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={finderMode === 'id'} onChange={() => setFinderMode('id')} className="accent-orange-500" /> ID指定</label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={finderMode === 'keyword'} onChange={() => setFinderMode('keyword')} className="accent-orange-500" /> キーワード検索</label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={finderMode === 'auto'} onChange={() => setFinderMode('auto')} className="accent-orange-500" /> AIおまかせ</label></div>
                        <div className="flex gap-2">{finderMode !== 'auto' && (<input type="text" value={finderInput} onChange={(e) => setFinderInput(e.target.value)} placeholder={finderMode === 'id' ? "Video ID" : "Keywords"} className="flex-1 p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none" />)}<button onClick={handleFindVideo} disabled={isGenerating || (finderMode !== 'auto' && !finderInput)} className={`px-6 rounded-lg font-bold transition ${isGenerating ? 'bg-gray-600' : 'bg-orange-600 hover:bg-orange-500'}`}>{isGenerating ? <RotateCw className="animate-spin" /> : '🔍 探す'}</button></div>{finderMessage && <p className="text-sm text-gray-400">{finderMessage}</p>}{foundVideos.length > 0 && (<div className="mt-4"><div className="flex justify-between items-center mb-2"><span className="font-bold text-lg">{foundVideos.length} Videos Found</span><button onClick={handleSaveAllFoundVideos} disabled={isGenerating} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2 disabled:opacity-50"><Save size={18} /> 全件一括保存</button></div><div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">{foundVideos.map((v, i) => (<div key={i} className={`p-3 rounded-lg border flex gap-4 items-center ${v.status === 'done' ? 'bg-green-900/30 border-green-600' : v.status === 'saving' ? 'bg-orange-900/30 border-orange-500 animate-pulse' : 'bg-gray-900 border-gray-700'}`}><img src={v.thumbnail} alt="thumb" className="w-32 h-20 object-cover rounded" /><div className="flex-1 min-w-0"><p className="font-bold truncate">{v.title}</p><p className="text-xs text-gray-500">{v.videoId}</p></div><div className="w-24 text-right font-bold text-sm">{v.status === 'waiting' && <span className="text-gray-500">待機中</span>}{v.status === 'saving' && <span className="text-orange-400">処理中...</span>}{v.status === 'done' && <span className="text-green-400 flex items-center justify-end gap-1"><CheckCircle size={16} /> 完了</span>}{v.status === 'error' && <span className="text-red-400">エラー</span>}</div></div>))}</div></div>)}</div>)}

                {/* 2. 字幕DB管理 (Batch) */}
                {activeTab === 'batch' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-cyan-500 space-y-4 animate-fade-in">
                        <h2 className="font-bold text-xl mb-4 text-cyan-400 flex items-center gap-2">📺 字幕データ一括生成</h2>

                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-600 space-y-2">
                            <p className="text-gray-400 text-xs uppercase font-bold mb-2">Missing Video IDs ({missingVideos.length})</p>
                            <textarea
                                readOnly
                                value={missingIdsString}
                                rows={3}
                                className="w-full bg-gray-700 text-gray-300 p-2 text-xs rounded font-mono"
                            />
                            <button
                                onClick={() => { navigator.clipboard.writeText(missingIdsString); alert('IDをクリップボードにコピーしました！'); }}
                                className="w-full bg-cyan-700 hover:bg-cyan-600 text-white p-2 rounded text-sm font-bold flex items-center justify-center gap-2"
                            >
                                <Clipboard size={18} /> IDリストをコピー
                            </button>
                            <p className="text-xs text-gray-500 mt-2">
                                **検証用:** 字幕がない動画IDをコピーし、外部のツールで検証してください。
                            </p>
                        </div>

                        <div className="flex gap-4 mb-6">
                            <button onClick={isGenerating ? cancelProcessing : runBatchProcess} disabled={missingVideos.length === 0} className={`flex-1 rounded-lg font-bold text-lg shadow-lg flex items-center justify-center gap-2 ${isGenerating ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}>
                                {isGenerating ? <><StopCircle size={20} /> 中断 (Processing {processingIndex! + 1}/{missingVideos.length})</> : '🚀 Start Batch Generation'}
                            </button>
                        </div>

                        <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs border border-gray-700">
                            {processLog.map((log, i) => <div key={i} className={`mb-1 ${log.includes('Success') ? 'text-green-400' : log.includes('Error') || log.includes('Failed') ? 'text-red-400' : 'text-gray-300'}`}>{log}</div>)}
                        </div>
                    </div>
                )}

                {/* 3. コンテンツ量産工場 (Factory) */}
                {activeTab === 'factory' && (
                    <div className="bg-gray-800 p-8 rounded-xl border border-pink-500 space-y-6 animate-fade-in">
                        <h2 className="font-bold text-2xl text-pink-400 mb-4 flex items-center gap-2"><Factory /> Content Factory (Mass Production)</h2>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div><p className="text-sm font-bold text-gray-400 mb-2">1. ターゲット言語</p><div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer p-3 rounded border border-gray-600 bg-gray-900 flex-1"><input type="radio" checked={factoryTarget === 'single'} onChange={() => setFactoryTarget('single')} className="accent-pink-500" /><span className="font-bold">{currentAdminSubject} のみ</span></label><label className="flex items-center gap-2 cursor-pointer p-3 rounded border border-gray-600 bg-gray-900 flex-1"><input type="radio" checked={factoryTarget === 'all'} onChange={() => setFactoryTarget('all')} className="accent-pink-500" /><span className="font-bold text-yellow-400">全言語一括</span></label></div></div>
                                <div><p className="text-sm font-bold text-gray-400 mb-2">2. コンテンツタイプ</p><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 cursor-pointer p-3 rounded border border-gray-600 bg-gray-900 flex-1 min-w-[140px]"><input type="radio" checked={factoryContentType === 'wordbook'} onChange={() => { setFactoryContentType('wordbook'); setFactoryCount(10); }} className="accent-pink-500" /><span className="font-bold">📚 単語帳</span></label><label className="flex items-center gap-2 cursor-pointer p-3 rounded border border-gray-600 bg-gray-900 flex-1 min-w-[140px]"><input type="radio" checked={factoryContentType === 'drill'} onChange={() => { setFactoryContentType('drill'); setFactoryCount(10); }} className="accent-pink-500" /><span className="font-bold">✍️ ドリル</span></label><label className="flex items-center gap-2 cursor-pointer p-3 rounded border border-gray-600 bg-gray-900 flex-1 min-w-[140px]"><input type="radio" checked={factoryContentType === 'textbook'} onChange={() => { setFactoryContentType('textbook'); setFactoryCount(1); }} className="accent-pink-500" /><span className="font-bold">📖 教科書</span></label></div></div>
                                <div><p className="text-sm font-bold text-gray-400 mb-2">3. 生成数 (各レベルごと)</p><div className="flex items-center gap-4"><input type="range" min="1" max={factoryContentType === 'textbook' ? 3 : 100} value={factoryCount} onChange={(e) => setFactoryCount(parseInt(e.target.value))} className="flex-1 accent-pink-500" /><span className="text-xl font-bold text-white w-12 text-center">{factoryCount}</span></div></div>
                                <button onClick={runContentFactory} disabled={isGenerating} className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg mt-6 flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-600' : 'bg-pink-600 hover:bg-pink-500 text-white'}`}>{isGenerating ? <><RotateCw className="animate-spin" /> Manufacturing...</> : '🏭 Start Production'}</button>
                            </div>

                            <div className="bg-black rounded-xl p-4 h-80 overflow-y-auto border border-gray-700 font-mono text-xs flex flex-col"><div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2"><span className="text-gray-400">Production Log</span><span className="text-pink-400 font-bold">{factoryProgress}%</span></div><div className="flex-1 overflow-y-auto space-y-1">{factoryLogs.map((log, i) => <div key={i} className={`truncate ${log.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{log}</div>)}</div></div>
                        </div>
                    </div>
                )}

                {/* 4. セットアップ */}
                {activeTab === 'setup' && (
                    <div className="bg-gray-800 p-8 rounded-xl border border-green-600 space-y-6 animate-fade-in">
                        <h2 className="font-bold text-2xl text-green-400 mb-4">🚀 New Subject Setup ({currentAdminSubject})</h2>
                        <div className="pt-4 border-t border-gray-700">
                            {setupStep === 1 && (<button onClick={() => runSetupStep(1)} disabled={isGenerating} className="w-full py-4 rounded-lg font-bold text-lg bg-green-600 hover:bg-green-500 transition text-white">{isGenerating ? <span className='flex items-center justify-center'><RotateCw className='w-5 h-5 mr-2 animate-spin' />Generating...</span> : `1. 単語帳とテスト問題を作成`}</button>)}{setupStep === 2 && (<button onClick={() => runSetupStep(2)} disabled={isGenerating} className="w-full py-4 rounded-lg font-bold text-lg bg-blue-600 hover:bg-blue-500 transition text-white">{isGenerating ? <span className='flex items-center justify-center'><RotateCw className='w-5 h-5 mr-2 animate-spin' />Generating...</span> : `2. 基礎教科書を生成・登録`}</button>)}{setupStep === 3 && (<div className="text-center text-green-400 text-xl font-bold">✅ セットアップ完了！</div>)}
                        </div>
                    </div>
                )}

                {/* 5. 教科書個別生成 */}
                {activeTab === 'textbook' && (
                    <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                        <div className="bg-gray-800 p-6 rounded-xl space-y-6 border border-gray-700">
                            <h2 className="font-bold text-xl text-blue-400">1. AI Generator ({currentAdminSubject})</h2>
                            <div><label className="block text-sm text-gray-400 mb-2">Category / Level</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none">{categoryOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>
                            <div><label className="block text-sm text-gray-400 mb-2">Topic (Empty = Auto)</label><input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Present Perfect" className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none" /></div>
                            <button onClick={handleGenerate} disabled={isGenerating} className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transition ${isGenerating ? 'opacity-50' : 'bg-blue-600 hover:bg-blue-500'}`}>{isGenerating ? 'Thinking...' : '🎲 テーマ自動決定 & 執筆'}</button>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-xl space-y-4 flex flex-col border border-gray-700">
                            <h2 className="font-bold text-xl text-green-400">2. Publish</h2>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full p-3 rounded bg-gray-900 border border-gray-600 font-bold" />
                            <div className="relative flex-1 min-h-[300px]"><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content..." className="w-full h-full p-3 rounded bg-gray-900 border border-gray-600 font-mono text-sm resize-none" /><button onClick={() => setIsSearchOpen(true)} className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-xs font-bold shadow-lg">📺 動画追加</button></div>
                            <button onClick={handleSave} disabled={isSaving || !title} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold shadow-lg disabled:opacity-50">{isSaving ? 'Saving...' : '🚀 Publish & Auto-Generate Wordbook'}</button>
                        </div>
                    </div>
                )}

                {/* 6. 読み物生成 */}
                {activeTab === 'reading' && (
                    <div className="bg-gray-800 p-8 rounded-xl border border-indigo-500 space-y-6 animate-fade-in max-w-2xl mx-auto">
                        <h2 className="font-bold text-2xl text-indigo-400 mb-4 flex items-center gap-2"><Book /> Reading Content Generator</h2>
                        <div className="space-y-4">
                            <div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={readingCategory === 'novel'} onChange={() => setReadingCategory('novel')} className="accent-indigo-500" /> Novel</label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={readingCategory === 'essay'} onChange={() => setReadingCategory('essay')} className="accent-indigo-500" /> Essay</label></div>
                            <select value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none">{CEFR_LEVELS_SHORT.map(l => <option key={l} value={l}>{l}</option>)}</select>
                            <input type="text" value={readingTopic} onChange={(e) => setReadingTopic(e.target.value)} placeholder="Topic (Optional)" className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none" />
                            <button onClick={handleGenerateReading} disabled={isGenerating} className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50`}>{isGenerating ? <RotateCw className="animate-spin" /> : '🚀 Generate Reading Material'}</button>
                        </div>
                    </div>
                )}

                {/* 7. ロードマップ管理 */}
                {activeTab === 'roadmap' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in max-w-2xl mx-auto">
                        <h2 className="font-bold text-xl mb-4 text-purple-400">🗺️ Roadmap Auto-Generator ({currentAdminSubject})</h2>
                        <div className="space-y-6">
                            <div><label className="block text-sm text-gray-400 mb-2">Target Level</label><select value={roadmapLevel} onChange={(e) => setRoadmapLevel(e.target.value)} className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none">{CEFR_LEVELS_SHORT.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}</select></div>
                            <div><label className="block text-sm text-gray-400 mb-2">Search Keywords</label><input type="text" value={roadmapQuery} onChange={(e) => setRoadmapQuery(e.target.value)} placeholder={`Default: ${currentAdminSubject} stories`} className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 outline-none" /></div>
                            <button onClick={handleGenerateRoadmap} disabled={isGenerating} className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transition ${isGenerating ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}>{isGenerating ? <span className='flex items-center justify-center'><RotateCw className='w-5 h-5 mr-2 animate-spin' />Generating...</span> : `🚀 Generate & Add Videos for Lvl ${roadmapLevel}`}</button>
                        </div>
                    </div>
                )}

                {/* 8. 日替わり設定 */}
                {activeTab === 'daily' && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in max-w-2xl mx-auto">
                        <h2 className="font-bold text-xl mb-4 text-yellow-400">📅 Today's Pick Configuration ({currentAdminSubject})</h2>
                        <div className="space-y-4"><button onClick={handleAiDailyPick} disabled={isGenerating} className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg mb-4 flex items-center justify-center gap-2 ${isGenerating ? 'opacity-50' : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:opacity-90'}`}>{isGenerating ? 'Thinking...' : '🤖 AI Auto-Select'}</button><input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Video ID" className="w-full p-3 rounded bg-gray-900 border border-gray-600" /><input type="text" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message" className="w-full p-3 rounded bg-gray-900 border border-gray-600" /><button onClick={handleSaveDaily} className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded font-bold">Set as Today's Pick</button></div>
                    </div>
                )}

                {/* 9. コメント & 受信箱 & セットアップ */}
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
                {activeTab === 'inquiry' && (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        <div className="divide-y divide-gray-700 max-h-[70vh] overflow-y-auto">
                            {inquiries.map((item) => (
                                <div key={item.id} className={`p-6 transition ${!item.is_read ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-gray-800'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs px-2 py-1 rounded font-bold uppercase bg-blue-900 text-blue-200">{item.category}</span>
                                        {!item.is_read && <button onClick={() => markAsRead(item.id)} className="text-xs bg-green-600 text-white px-2 rounded-full">New!</button>}
                                    </div>
                                    <p className="text-gray-200 whitespace-pre-wrap">{item.message}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {isSearchOpen && <VideoSearchModal onClose={() => setIsSearchOpen(false)} onSelect={(id) => { if (activeTab === 'daily') setTopic(id); else insertVideo(id); setIsSearchOpen(false); }} />}
        </main>
    );
}