'use client';

import { useState, useEffect, Suspense } from 'react';
import YouTube, { YouTubePlayer } from 'react-youtube';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import VoiceRecorder from '@/components/VoiceRecorder';
import UserStatus from '@/components/UserStatus';
import CommentSection from '@/components/CommentSection';
import Heatmap from '@/components/Heatmap';
import PlacementTest from '@/components/PlacementTest';
import VideoSearchModal from '@/components/VideoSearchModal';

// --- 型定義 ---
type Subtitle = { text: string; offset: number; duration: number; };
type DictionaryData = {
  word: string; phonetic?: string; audio?: string; translation?: string;
  meanings: { partOfSpeech: string; definitions: { definition: string }[]; }[];
};
type UserProfile = {
  id: string; level: number; xp: number; next_level_xp: number;
  theme: 'kids' | 'student' | 'pro';
  goal: string;
  placement_test_done: boolean;
};

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVideoId = searchParams.get('videoId') || 'arj7oStGLkU';

  // ユーザー情報
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('Hero');
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: '', level: 1, xp: 0, next_level_xp: 100, theme: 'student', goal: '', placement_test_done: true
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // 設定パネル開閉
  const [showPlacementTest, setShowPlacementTest] = useState(false);

  // 新機能State
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 動画関連
  const [videoId, setVideoId] = useState(initialVideoId);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // 学習機能
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [dictData, setDictData] = useState<DictionaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [manualTargetText, setManualTargetText] = useState<string | null>(null);

  // 編集用の一時ステート
  const [editName, setEditName] = useState('');

  // --- テーマ設定 ---
  const getThemeStyles = () => {
    switch (userProfile.theme) {
      case 'kids': return 'font-sans text-lg bg-yellow-50 text-gray-900';
      case 'pro': return 'font-mono text-sm bg-gray-900 text-gray-100';
      default: return 'font-sans text-base bg-gray-50 text-gray-800';
    }
  };

  // --- 初期化 ---
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth'); return; }
      setUserId(session.user.id);
      fetchProfile(session.user.id);
      if (initialVideoId) loadVideo(initialVideoId);
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) {
      setUserProfile(data);
      setUsername(data.username || 'Hero');
      setEditName(data.username || 'Hero');
      if (data.placement_test_done === false) setShowPlacementTest(true);
    }
  };

  // --- 学習ログ & XP ---
  const logStudyActivity = async () => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('study_logs').select('*').match({ user_id: userId, date: today }).single();
    if (existing) {
      await supabase.from('study_logs').update({ count: existing.count + 1 }).eq('id', existing.id);
    } else {
      await supabase.from('study_logs').insert({ user_id: userId, date: today, count: 1 });
    }
  };

  const addXp = async (amount: number) => {
    if (!userId) return;
    const { data: current } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!current) return;

    let newXp = current.xp + amount;
    let newLevel = current.level;
    let newNextXp = current.next_level_xp;
    let leveledUp = false;

    if (newXp >= newNextXp) {
      newXp -= newNextXp;
      newLevel += 1;
      newNextXp = Math.floor(newNextXp * 1.2);
      leveledUp = true;
    }

    await supabase.from('profiles').update({ level: newLevel, xp: newXp, next_level_xp: newNextXp }).eq('id', userId);
    setUserProfile({ ...current, level: newLevel, xp: newXp, next_level_xp: newNextXp });
    if (leveledUp) alert(`🎉 LEVEL UP! Lv.${newLevel}!`);
    logStudyActivity();
  };

  // 設定変更：テーマ
  const handleThemeChange = async (newTheme: 'kids' | 'student' | 'pro') => {
    if (!userId) return;
    try {
      const { error } = await supabase.from('profiles').update({ theme: newTheme }).eq('id', userId);
      if (error) throw error;
      setUserProfile(prev => ({ ...prev, theme: newTheme }));
    } catch (e) {
      console.error(e);
      alert('設定の保存に失敗しました');
    }
  };

  // 設定変更：名前
  const handleNameSave = async () => {
    if (!userId || !editName.trim()) return;
    try {
      const { error } = await supabase.from('profiles').update({ username: editName }).eq('id', userId);
      if (error) throw error;
      setUsername(editName);
      alert('名前を変更しました');
    } catch (e) {
      alert('名前の変更に失敗しました');
    }
  };

  const handleGoalChange = async () => {
    const newGoal = prompt("目標を入力してください (例: TOEIC 800)", userProfile.goal || "");
    if (newGoal !== null && userId) {
      await supabase.from('profiles').update({ goal: newGoal }).eq('id', userId);
      setUserProfile(prev => ({ ...prev, goal: newGoal }));
    }
  };

  // --- 動画機能 ---
  const loadVideo = async (idOverride?: string) => {
    const targetId = idOverride || videoId;
    if (idOverride) setVideoId(idOverride);
    setSubtitles([]); setDictData(null); setSelectedWord(null); setManualTargetText(null);
    try {
      const res = await fetch(`/api/transcript?videoId=${targetId}`);
      const data = await res.json();
      if (data.error) alert(`字幕取得エラー: ${data.error}`);
      else {
        setSubtitles(data);
        logStudyActivity();
      }
    } catch (e) { console.error(e); alert('通信エラー'); }
  };

  const handleSaveToLibrary = async () => {
    if (!userId || subtitles.length === 0) return;
    if (!confirm('ライブラリに登録しますか？')) return;
    setIsRegistering(true);
    try {
      const { data: existing } = await supabase.from('library_videos').select('id').match({ user_id: userId, video_id: videoId }).single();
      if (existing) { alert('登録済みです'); setIsRegistering(false); return; }

      const { error: ve } = await supabase.from('library_videos').insert([{ user_id: userId, video_id: videoId, title: `Video ${videoId}`, thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` }]);
      if (ve) throw ve;

      const rows = subtitles.map(s => ({ user_id: userId, video_id: videoId, text: s.text, start_time: s.offset / 1000, duration: s.duration / 1000 }));
      const { error: se } = await supabase.from('library_subtitles').insert(rows);
      if (se) throw se;

      await addXp(100);
      alert('登録完了 (+100 XP)');
    } catch (e) { alert('登録失敗'); }
    finally { setIsRegistering(false); }
  };

  // --- 辞書機能 ---
  const handleWordClick = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
    setSelectedWord(clean); setDictData(null); setIsLoading(true);
    try {
      const [dRes, tRes] = await Promise.all([
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${clean}`),
        fetch(`https://api.mymemory.translated.net/get?q=${clean}&langpair=en|ja`)
      ]);
      let dEntry = null, trans = "";
      if (dRes.ok) { const d = await dRes.json(); dEntry = d[0]; }
      if (tRes.ok) { const d = await tRes.json(); trans = d.responseData.translatedText; }
      const audio = dEntry?.phonetics.find((p: any) => p.audio)?.audio;
      setDictData({ word: clean, phonetic: dEntry?.phonetic, audio, translation: trans, meanings: dEntry?.meanings.slice(0, 2) || [] });
    } catch { setDictData({ word: clean, meanings: [], translation: "エラー" }); }
    finally { setIsLoading(false); }
  };

  const handleSaveWord = async () => {
    if (!userId || !dictData) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('vocab').insert([{ user_id: userId, word: dictData.word, translation: dictData.translation || 'なし' }]);
      if (error) throw error;
      await addXp(10);
      alert(`保存しました (+10 XP)`);
    } catch { alert('保存失敗'); }
    finally { setIsSaving(false); }
  };

  // --- プレイヤー制御 ---
  const onReady = (e: { target: YouTubePlayer }) => {
    setPlayer(e.target);
    const start = searchParams.get('start');
    if (start) { e.target.seekTo(parseInt(start), true); e.target.playVideo(); }
  };
  const handleSeek = (ms: number) => player?.seekTo(ms / 1000, true);
  useEffect(() => {
    const i = setInterval(() => { if (player?.getPlayerState() === 1) setCurrentTime(player.getCurrentTime()); }, 100);
    return () => clearInterval(i);
  }, [player]);
  const playAudio = () => dictData?.audio && new Audio(dictData.audio).play();
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/auth'); };

  if (!userId) return <div className="p-10 text-center">Loading...</div>;

  const isPro = userProfile.theme === 'pro';
  const isKids = userProfile.theme === 'kids';

  return (
    <main className={`min-h-screen pb-20 md:p-8 flex flex-col items-center transition-colors duration-500 ${getThemeStyles()}`}>

      {showPlacementTest && userId && (
        <PlacementTest userId={userId} onComplete={() => setShowPlacementTest(false)} />
      )}

      {/* ヘッダー */}
      <div className={`w-full max-w-6xl flex flex-wrap justify-between items-center p-4 md:p-0 md:mb-6 sticky top-0 z-50 md:static border-b md:border-none ${isPro ? 'bg-gray-900 border-gray-800' : 'bg-white/90 backdrop-blur-sm'}`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-xl md:text-3xl font-bold ${isKids ? 'font-comic text-yellow-500 tracking-wider' : ''}`}>
            {isKids ? '🐯 English Dojo' : 'My Language Dojo'}
          </h1>
          <button onClick={handleGoalChange} className={`text-xs px-2 py-1 rounded border ${isPro ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
            🎯 {userProfile.goal || '目標を設定'}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2 md:mt-0">
          <span className="hidden md:inline text-sm font-bold opacity-70 mr-2">{username}</span>
          <div className="scale-75 origin-right md:scale-100">
            <UserStatus level={userProfile.level} xp={userProfile.xp} nextLevelXp={userProfile.next_level_xp} />
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="text-xl p-1 hover:opacity-70 transition">⚙️</button>
        </div>
      </div>

      {/* --- 設定パネル (シンプル版) --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full text-black shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">⚙️ 設定</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 text-xl">×</button>
            </div>

            <div className="mb-6">
              <p className="mb-2 font-bold text-sm text-gray-500">モード切替</p>
              <div className="flex gap-2">
                <button onClick={() => handleThemeChange('kids')} className={`flex-1 py-3 rounded-lg border font-bold transition ${userProfile.theme === 'kids' ? 'bg-yellow-100 border-yellow-400 text-yellow-700 ring-2 ring-yellow-200' : 'hover:bg-gray-50'}`}>👶 Kids</button>
                <button onClick={() => handleThemeChange('student')} className={`flex-1 py-3 rounded-lg border font-bold transition ${userProfile.theme === 'student' ? 'bg-blue-100 border-blue-400 text-blue-700 ring-2 ring-blue-200' : 'hover:bg-gray-50'}`}>🧑‍🎓 Std</button>
                <button onClick={() => handleThemeChange('pro')} className={`flex-1 py-3 rounded-lg border font-bold transition ${userProfile.theme === 'pro' ? 'bg-gray-800 text-white border-black ring-2 ring-gray-500' : 'hover:bg-gray-50'}`}>😎 Pro</button>
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-2 font-bold text-sm text-gray-500">名前変更</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border p-2 rounded text-black"
                />
                <button onClick={handleNameSave} className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700">保存</button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <button onClick={handleLogout} className="w-full text-red-500 text-sm py-2 hover:bg-red-50 rounded transition">ログアウト</button>
            </div>
          </div>
        </div>
      )}

      {/* サブメニュー */}
      <div className={`w-full max-w-6xl flex gap-2 overflow-x-auto p-2 md:p-0 mb-4 ${isPro ? 'text-gray-300' : ''}`}>
        <Link href="/search" className="bg-blue-500 text-white px-3 py-1 rounded text-sm font-bold whitespace-nowrap">🔍 {isKids ? 'さがす' : 'Search'}</Link>
        <Link href="/vocab" className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold whitespace-nowrap">📚 {isKids ? 'たんご' : 'Vocab'}</Link>
        <Link href="/textbook" className="bg-orange-500 text-white px-3 py-1 rounded text-sm font-bold whitespace-nowrap">📖 {isKids ? 'ほん' : 'Textbook'}</Link>
        <button onClick={handleSaveToLibrary} disabled={isRegistering || subtitles.length === 0} className="bg-purple-600 text-white px-3 py-1 rounded text-sm font-bold whitespace-nowrap disabled:opacity-50">💾 {isKids ? 'ほぞん' : 'Save Lib'}</button>
      </div>

      {/* PC検索バー */}
      <div className="hidden md:flex w-full max-w-6xl mb-6 gap-2">
        <button
          onClick={() => setIsSearchOpen(true)}
          className={`flex-1 border rounded-lg text-left px-4 py-2 transition flex items-center gap-2 ${isPro ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-500'}`}
        >
          <span className="text-xl">🔍</span> YouTube動画を検索・選択...
        </button>
        <input type="text" value={videoId} onChange={(e) => setVideoId(e.target.value)} className={`w-32 border p-2 rounded text-sm ${isPro ? 'bg-gray-800 text-white border-gray-700' : 'text-black'}`} placeholder="ID" />
        <button onClick={() => loadVideo()} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-bold">Play</button>
      </div>

      {/* メインエリア */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full max-w-6xl px-4 md:px-0">
        <div className="flex-1 flex flex-col gap-4 sticky top-14 md:static z-30">
          {!isKids && userId && <Heatmap userId={userId} />}

          <div className={`relative aspect-video rounded-lg overflow-hidden shadow-xl shrink-0 transition-all ${isAudioOnly ? 'opacity-0 h-0 pointer-events-none' : 'bg-black'}`}>
            <YouTube videoId={videoId} onReady={onReady} opts={{ width: '100%', height: '100%', playerVars: { autoplay: 0 } }} className="absolute top-0 left-0 w-full h-full" />
          </div>

          <button onClick={() => setIsAudioOnly(!isAudioOnly)} className={`w-full py-3 rounded-lg font-bold shadow transition flex items-center justify-center gap-2 ${isAudioOnly ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {isAudioOnly ? '🙈 Audio Only (ON) - Tap to Show Video' : '🙉 Switch to Audio Only'}
          </button>

          <div className={`${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-xl shadow-sm border overflow-hidden`}>
            <VoiceRecorder targetText={manualTargetText || subtitles.find(s => { const start = s.offset / 1000; const end = start + (s.duration / 1000); return currentTime >= start && currentTime < end; })?.text || ""} />
          </div>

          <CommentSection videoId={videoId} />
        </div>

        <div className={`flex-1 rounded-lg shadow-lg border p-2 md:p-4 min-h-[300px] ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <h2 className="text-sm opacity-50 font-bold mb-2 px-2">Transcript</h2>
          <div className="space-y-2 h-[400px] md:h-[600px] overflow-y-auto">
            {subtitles.length > 0 ? (
              subtitles.map((sub, i) => (
                <div key={i} onClick={() => { handleSeek(sub.offset); setManualTargetText(sub.text); }} className={`cursor-pointer p-3 rounded text-base md:text-lg leading-relaxed transition-colors border-b ${isPro ? 'border-gray-700 hover:bg-gray-700 text-gray-300' : 'border-gray-50 hover:bg-gray-100 text-gray-700'} ${manualTargetText === sub.text ? (isPro ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-green-50 border-l-4 border-green-500') : ''}`}>
                  {(sub.text || '').split(' ').map((word, wIndex) => {
                    const isHard = word.length >= 6;
                    return (<span key={wIndex} onClick={(e) => handleWordClick(word, e)} className={`inline-block mx-0.5 px-0.5 rounded ${isHard ? 'text-blue-500 font-bold' : ''}`}>{word}</span>);
                  })}
                </div>
              ))
            ) : <p className="opacity-50 text-center mt-10">Waiting for video...</p>}
          </div>
        </div>
      </div>

      {/* 辞書ポップアップ */}
      {selectedWord && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSelectedWord(null)} />
          <div className={`fixed z-50 shadow-2xl border-gray-200 bottom-0 left-0 w-full rounded-t-2xl p-6 border-t animate-slide-up md:top-20 md:right-10 md:w-80 md:rounded-xl md:border md:bottom-auto md:left-auto md:p-6 ${isPro ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-black'}`}>
            <div className="flex justify-between items-start mb-4 border-b pb-2">
              <h3 className="text-3xl font-bold capitalize">{selectedWord}</h3>
              <button onClick={() => setSelectedWord(null)} className="text-2xl opacity-50">×</button>
            </div>
            {isLoading ? <p>Loading...</p> : dictData ? (
              <div className="space-y-4">
                <p className="text-xl font-bold">{dictData.translation}</p>
                {dictData.meanings.length > 0 && (<div className="pr-2 text-sm opacity-80">{dictData.meanings[0].definitions[0].definition}</div>)}
                <button onClick={handleSaveWord} disabled={isSaving} className={`w-full py-3 rounded-lg font-bold shadow-lg ${isSaving ? 'bg-gray-500' : 'bg-green-600 text-white'}`}>{isSaving ? 'Saving...' : '＋ Save'}</button>
              </div>
            ) : <p>No data</p>}
          </div>
        </>
      )}

      {/* 動画検索モーダル */}
      {isSearchOpen && (
        <VideoSearchModal
          onClose={() => setIsSearchOpen(false)}
          onSelect={(id) => {
            setVideoId(id);
            setIsSearchOpen(false);
            setTimeout(() => loadVideo(id), 100);
          }}
        />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}


