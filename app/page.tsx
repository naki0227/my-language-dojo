'use client';

import { useState, useEffect, Suspense } from 'react';
import YouTube, { YouTubePlayer } from 'react-youtube';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import VoiceRecorder from '@/components/VoiceRecorder';
import UserStatus from '@/components/UserStatus';
import CommentSection from '@/components/CommentSection';
import ProfileModal from '@/components/ProfileModal';
import Heatmap from '@/components/Heatmap';
import PlacementTest from '@/components/PlacementTest';
import AIChatButton from '@/components/AIChatButton';
import InternalVideoSearchModal from '@/components/InternalVideoSearchModal '; // 内部検索を使用
import { SUPPORTED_LANGUAGES } from '@/lib/constants';

// --- 型定義 ---
type Subtitle = { text: string; translation?: string; offset: number; duration: number; translations: { [key: string]: string }; };
type DictionaryData = {
  word: string; phonetic?: string; audio?: string; translation?: string;
  sourceLang?: string;
  meanings?: { partOfSpeech: string; definitions: { definition: string }[]; }[];
};
type UserLevelData = {
  user_id: string;
  subject: string;
  level_result: string;
  score: number;
  xp: number;
};
type UserProfile = {
  id: string; level: number; xp: number; next_level_xp: number;
  theme: 'kids' | 'student' | 'pro';
  goal: string;
  placement_test_done: boolean;
  learning_target: string;
};

const CEFR_LEVELS = [
  'A1 (Beginner)', 'A2 (Elementary)', 'B1 (Intermediate)', 'B2 (Upper Intermediate)',
  'C1 (Advanced)', 'C2 (Master)'
];

const XP_CAP = 1000;

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVideoId = searchParams.get('videoId') || 'arj7oStGLkU';

  // ユーザー情報
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('Hero');
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: '', level: 1, xp: 0, next_level_xp: 100, theme: 'student', goal: '', placement_test_done: true, learning_target: 'English'
  });

  const [currentLevelData, setCurrentLevelData] = useState<UserLevelData>({
    user_id: '', subject: 'English', level_result: 'A1 (Beginner)', score: 0, xp: 0
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPlacementTest, setShowPlacementTest] = useState(false);

  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [videoId, setVideoId] = useState(initialVideoId);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [dictData, setDictData] = useState<DictionaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [manualTargetText, setManualTargetText] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // AI翻訳用キャッシュ管理
  const [targetLang, setTargetLang] = useState('ja');
  const [loadedLang, setLoadedLang] = useState<string | null>(null);
  const [isSubtitleLoading, setIsSubtitleLoading] = useState(false);

  const getThemeStyles = () => {
    switch (userProfile.theme) {
      case 'kids': return 'font-sans text-lg bg-yellow-50 text-gray-900';
      case 'pro': return 'font-mono text-sm bg-gray-900 text-gray-100';
      default: return 'font-sans text-base bg-gray-50 text-gray-800';
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth'); return; }
      setUserId(session.user.id);
      fetchProfile(session.user.id);
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const paramVideoId = searchParams.get('videoId');
    if (paramVideoId && paramVideoId !== videoId) {
      loadVideo(paramVideoId);
    } else if (!videoId && paramVideoId) {
      loadVideo(paramVideoId);
    } else if (!videoId && initialVideoId) {
      loadVideo(initialVideoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchProfile = async (uid: string) => {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (profileData) {
      setUserProfile(profileData as UserProfile);
      setUsername(profileData.username || 'Hero');
      setEditName(profileData.username || 'Hero');
      if (profileData.placement_test_done === false) setShowPlacementTest(true);

      const { data: levelData } = await supabase
        .from('user_levels')
        .select('*')
        .match({ user_id: uid, subject: profileData.learning_target })
        .single();

      const initialLevel = { user_id: uid, subject: profileData.learning_target, level_result: 'A1 (Beginner)', score: 0, xp: 0 };
      if (levelData) {
        setCurrentLevelData(levelData as UserLevelData);
      } else {
        await supabase.from('user_levels').insert(initialLevel);
        setCurrentLevelData(initialLevel as UserLevelData);
      }
    }
  };

  const logStudyActivity = async () => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('study_logs').select('*').match({ user_id: userId, date: today }).single();
    if (existing) { await supabase.from('study_logs').update({ count: existing.count + 1 }).eq('id', existing.id); }
    else { await supabase.from('study_logs').insert({ user_id: userId, date: today, count: 1 }); }
  };

  const addXp = async (amount: number) => {
    if (!userId) return;
    const { data: current } = await supabase.from('user_levels').select('xp').match({ user_id: userId, subject: userProfile.learning_target }).single();
    if (!current) return;
    const newXp = current.xp + amount;
    await supabase.from('user_levels').update({ xp: newXp }).match({ user_id: userId, subject: userProfile.learning_target });
    setCurrentLevelData(prev => ({ ...prev, xp: newXp }));
    logStudyActivity();
  };

  const handleTargetLanguageChange = async (newLang: string) => {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ learning_target: newLang }).eq('id', userId);
      window.location.reload();
    } catch (e) { alert('設定の保存に失敗しました'); }
  };

  const handleManualLevelChange = async (newLevel: string) => {
    if (!userId) return;
    try {
      await supabase.from('user_levels').update({ level_result: newLevel }).match({ user_id: userId, subject: userProfile.learning_target });
      setCurrentLevelData(prev => ({ ...prev, level_result: newLevel }));
      alert(`${userProfile.learning_target} のレベルを ${newLevel} に設定しました！`);
    } catch (e) { alert('レベルの保存に失敗しました'); }
  };

  const handleThemeChange = async (newTheme: any) => {
    if (!userId) return;
    await supabase.from('profiles').update({ theme: newTheme }).eq('id', userId);
    setUserProfile(prev => ({ ...prev, theme: newTheme }));
  };
  const handleNameSave = async () => {
    if (!userId) return;
    await supabase.from('profiles').update({ username: editName }).eq('id', userId);
    setUsername(editName); alert('変更しました');
  };
  const handleGoalChange = async () => {
    const newGoal = prompt("目標を入力", userProfile.goal || "");
    if (newGoal && userId) { await supabase.from('profiles').update({ goal: newGoal }).eq('id', userId); setUserProfile(prev => ({ ...prev, goal: newGoal })); }
  };

  const loadVideo = async (idOverride?: string) => {
    const targetId = idOverride || videoId;
    if (!targetId) return;
    if (idOverride) setVideoId(targetId);

    setSubtitles([]); setDictData(null); setSelectedWord(null); setManualTargetText(null);
    setSelectedLangs([]); setLoadedLang(null); setShowTranslation(false);
    setIsSubtitleLoading(true);

    try {
      const res = await fetch(`/api/transcript?videoId=${targetId}`);
      const data = await res.json();
      if (data.error) {
        console.error(`字幕エラー: ${data.error}`);
      } else {
        const items = Array.isArray(data) ? data : [];
        const formatted = items.map((item: any) => ({ ...item, translations: {} }));
        setSubtitles(formatted);
        logStudyActivity();
      }
    } catch (e) { console.error('通信エラー', e); }
    finally { setIsSubtitleLoading(false); }
  };

  const fetchTranslations = async (langsToFetch: string[]) => {
    if (langsToFetch.length === 0) return;
    setIsTranslating(true);
    try {
      let updatedSubtitles = [...subtitles];
      const promises = langsToFetch.map(async (lang) => {
        if (updatedSubtitles.length > 0 && updatedSubtitles[0].translations[lang]) return null;
        const res = await fetch(`/api/transcript?videoId=${videoId}&lang=${lang}`);
        const data = await res.json();
        return { lang, data };
      });
      const results = await Promise.all(promises);
      results.forEach(result => {
        if (!result || result.data.error) return;
        updatedSubtitles = updatedSubtitles.map((sub, index) => {
          if (!result.data[index]) return sub;
          const translationText = result.data[index]?.translation || "";
          return { ...sub, translations: { ...sub.translations, [result.lang]: translationText } };
        });
      });
      setSubtitles(updatedSubtitles);
    } catch (e) { alert('翻訳エラー'); } finally { setIsTranslating(false); }
  };

  const toggleTranslation = async () => {
    if (showTranslation && loadedLang === targetLang) {
      setShowTranslation(false);
      return;
    }
    if (loadedLang !== targetLang || !subtitles[0]?.translation) {
      setIsTranslating(true);
      setShowTranslation(true);
      try {
        const res = await fetch(`/api/transcript?videoId=${videoId}&lang=${targetLang}`);
        const data = await res.json();
        if (data.error) {
          alert('翻訳に失敗しました');
          setShowTranslation(false);
        } else {
          const items = Array.isArray(data) ? data : [];
          const merged = subtitles.map((sub, i) => ({
            ...sub,
            translation: items[i]?.translation || ""
          }));
          setSubtitles(merged);
          setLoadedLang(targetLang);
        }
      } catch (e) {
        alert('翻訳エラー');
        setShowTranslation(false);
      } finally { setIsTranslating(false); }
    } else {
      setShowTranslation(true);
    }
  };

  const toggleLanguage = (langCode: string) => {
    let newLangs;
    if (selectedLangs.includes(langCode)) newLangs = selectedLangs.filter(l => l !== langCode);
    else {
      if (selectedLangs.length >= 3) { alert('最大3言語まで'); return; }
      newLangs = [...selectedLangs, langCode];
    }
    setSelectedLangs(newLangs);
    const addedLangs = newLangs.filter(l => !selectedLangs.includes(l));
    if (addedLangs.length > 0) fetchTranslations(addedLangs);
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
      await supabase.from('library_subtitles').insert(rows);
      await addXp(100); alert('登録完了 (+100 XP)');
    } catch (e) { alert('登録失敗'); }
    finally { setIsRegistering(false); }
  };

  const handleWordClick = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();

    if (userProfile.learning_target !== 'English') {
      setSelectedWord(cleanWord); setDictData(null); setIsLoading(true);
      try {
        // ★修正: 新しい抽象化APIを叩く
        const res = await fetch('/api/v1/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'analyze',
            payload: { word: cleanWord, targetLang: userProfile.learning_target }
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const result = JSON.parse(data.data); // GeminiはJSON文字列を返すためパースが必要

        setDictData({
          word: cleanWord,
          translation: result.translation || "翻訳できませんでした",
          sourceLang: result.sourceLang || userProfile.learning_target,
          meanings: [{ partOfSpeech: result.partOfSpeech || 'N/A', definitions: [{ definition: result.definition }] }]
        });

      } catch (e: any) {
        setDictData({ word: cleanWord, translation: `エラー: ${e.message}`, sourceLang: userProfile.learning_target });
      }
      finally { setIsLoading(false); }
      return;
    }

    setSelectedWord(cleanWord); setIsLoading(true);
    try {
      const [dRes, tRes] = await Promise.all([
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`),
        fetch(`https://api.mymemory.translated.net/get?q=${cleanWord}&langpair=en|ja`)
      ]);
      let dEntry = null, trans = "";
      if (dRes.ok) { const d = await dRes.json(); dEntry = d[0]; }
      if (tRes.ok) { const d = await tRes.json(); trans = d.responseData.translatedText; }
      const audio = dEntry?.phonetics.find((p: any) => p.audio)?.audio;
      setDictData({
        word: cleanWord, phonetic: dEntry?.phonetic, audio,
        translation: trans, meanings: dEntry?.meanings.slice(0, 2),
        sourceLang: 'English'
      });
    } catch { setDictData({ word: cleanWord, translation: "エラー", sourceLang: 'English' }); }
    finally { setIsLoading(false); }
  };

  const handleSaveWord = async () => {
    if (!userId || !dictData) return;
    setIsSaving(true);
    try {
      await supabase.from('vocab').insert([{ user_id: userId, word: dictData.word, translation: dictData.translation || 'なし', subject: userProfile.learning_target }]);
      await addXp(10); alert(`保存しました (+10 XP)`);
    } catch { alert('保存失敗'); }
    finally { setIsSaving(false); }
  };

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
    <main className={`h-screen flex flex-col bg-gray-50 transition-colors duration-500 ${getThemeStyles()} overflow-hidden`}>

      {showPlacementTest && userId && (
        <PlacementTest userId={userId} onComplete={() => setShowPlacementTest(false)} onSkip={() => setShowPlacementTest(false)} />
      )}

      {/* ヘッダー */}
      <div className={`shrink-0 w-full flex flex-wrap justify-between items-center p-4 border-b ${isPro ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-4">
          <h1 className={`text-xl font-bold ${isKids ? 'font-comic text-yellow-500' : ''}`}>
            {userProfile.learning_target} Dojo
          </h1>
          <div className="scale-75 origin-left">
            <UserStatus level={currentLevelData.level_result.split(' ')[0] || 'A1'} xp={currentLevelData.xp} nextLevelXp={XP_CAP} />
          </div>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="text-xl p-1 hover:opacity-70 transition">⚙️</button>
      </div>

      {/* 設定パネル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full text-black shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">⚙️ 設定</h3><button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 text-xl">×</button></div>
            <div className="space-y-4">
              <div className="border p-3 rounded-lg bg-gray-50">
                <p className="mb-2 font-bold text-sm text-indigo-600">現在のレベル ({userProfile.learning_target})</p>
                <select value={currentLevelData.level_result} onChange={(e) => handleManualLevelChange(e.target.value)} className="w-full p-2 border rounded text-black">
                  {CEFR_LEVELS.map(level => (<option key={level} value={level}>{level}</option>))}
                </select>
              </div>

              <div>
                <p className="mb-1 font-bold text-sm text-gray-500">学習対象</p>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleTargetLanguageChange(lang.label.split(' ')[1] || lang.code)}
                      className={`py-2 rounded-lg border font-bold text-sm transition 
                          ${userProfile.learning_target === (lang.label.split(' ')[1] || lang.code) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'hover:bg-gray-50'}`}
                    >
                      {lang.label}
                    </button>
                  ))}
                  <button onClick={() => handleTargetLanguageChange('Sign Language')} className={`py-2 rounded-lg border font-bold text-sm transition ${userProfile.learning_target === 'Sign Language' ? 'bg-green-100 text-green-700' : 'hover:bg-gray-50'}`}>🤟 手話</button>
                  <button onClick={() => handleTargetLanguageChange('Programming')} className={`py-2 rounded-lg border font-bold text-sm transition ${userProfile.learning_target === 'Programming' ? 'bg-red-100 text-red-700' : 'hover:bg-gray-50'}`}>💻 Code</button>
                </div>
              </div>

              <Link href="/dashboard" className="block w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-center py-3 rounded-lg font-bold shadow-md hover:opacity-90">🏠 ダッシュボード</Link>
              <Link href="/dashboard/archive" className="block w-full bg-gray-100 text-gray-700 text-center py-2 rounded-lg font-bold hover:bg-gray-200 text-sm">📅 過去のピックアップ</Link>

              <button onClick={handleLogout} className="w-full text-red-500 text-sm py-2 border rounded hover:bg-red-50">ログアウト</button>
            </div>
          </div>
        </div>
      )}

      {/* サブメニュー */}
      <div className={`shrink-0 w-full flex gap-2 overflow-x-auto p-2 border-b ${isPro ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-gray-50 border-gray-200'}`}>
        {/* 動画検索ボタン */}
        <button onClick={() => setIsSearchOpen(true)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">🔍 検索</button>
        <Link href="/vocab" className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">📚 単語</Link>
        <Link href="/drill" className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">🔥 ドリル</Link>
        <Link href="/textbook" className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">📖 教科書</Link>
        <Link href="/reading" className="bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">📚 読み物</Link>
        <button onClick={handleSaveToLibrary} disabled={isRegistering || subtitles.length === 0} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap disabled:opacity-50">💾 保存</button>
      </div>

      {/* === レイアウト本体 === */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* スマホビュー */}
        <div className="md:hidden flex flex-col h-full w-full">
          <div className={`shrink-0 w-full bg-black transition-all duration-300 ${isAudioOnly ? 'h-12' : 'aspect-video'}`}>
            {isAudioOnly ? (
              <div className="w-full h-full flex items-center justify-center text-white text-xs cursor-pointer" onClick={() => setIsAudioOnly(false)}>🙈 Audio Only (Tap)</div>
            ) : (
              <YouTube videoId={videoId} onReady={onReady} opts={{ width: '100%', height: '100%', playerVars: { autoplay: 0 } }} className="w-full h-full" />
            )}
          </div>
          {!isAudioOnly && <button onClick={() => setIsAudioOnly(true)} className="shrink-0 w-full py-2 bg-gray-200 text-xs font-bold text-gray-600 border-b">🙉 Audio Only</button>}

          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
            <div className={`rounded-lg shadow p-4 ${isPro ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-2 relative">
                <h2 className="text-sm opacity-50 font-bold">Transcript</h2>
                <div className="flex items-center gap-2">
                  {isTranslating && <span className="text-xs text-blue-500 animate-pulse">Generating...</span>}
                  <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    🌐 翻訳 ({selectedLangs.length}) {isLangMenuOpen ? '▲' : '▼'}
                  </button>
                </div>
                {isLangMenuOpen && (
                  <div className="absolute right-0 top-8 bg-white shadow-xl border rounded-xl p-3 z-50 w-48 text-black">
                    <p className="text-xs text-gray-400 mb-2 font-bold">最大3つまで選択可能</p>
                    <div className="space-y-1">
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <button key={lang.code} onClick={() => toggleLanguage(lang.code)} className={`w-full text-left px-2 py-2 rounded text-sm flex justify-between items-center ${selectedLangs.includes(lang.code) ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-50'}`}>
                          <span>{lang.label}</span>{selectedLangs.includes(lang.code) && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {isSubtitleLoading ? (
                  <div className="text-center py-10 text-gray-500 animate-pulse">字幕データを取得中...</div>
                ) : subtitles.length > 0 ? (
                  subtitles.map((sub, i) => (
                    <div key={i} onClick={() => { handleSeek(sub.offset); setManualTargetText(sub.text); }} className={`cursor-pointer p-3 rounded text-base leading-relaxed transition-colors border-b ${isPro ? 'border-gray-700 hover:bg-gray-700 text-gray-300' : 'border-gray-50 hover:bg-gray-100 text-gray-700'} ${manualTargetText === sub.text ? (isPro ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-green-50 border-l-4 border-green-500') : ''}`}>
                      <div className="mb-1">{(sub.text || '').split(' ').map((word, wIndex) => (<span key={wIndex} onClick={(e) => handleWordClick(word, e)} className={`inline-block mx-0.5 px-0.5 rounded ${word.length >= 6 ? 'text-blue-500 font-bold' : ''}`}>{word}</span>))}</div>
                      {showTranslation && sub.translation && (<div className="mt-1 text-sm text-blue-600 font-bold">{sub.translation}</div>)}
                      {selectedLangs.map(lang => (sub.translations && sub.translations[lang] ? (<div key={lang} className="text-base text-gray-500 mt-2 border-l-2 border-blue-200 pl-2"><span className="text-xs font-bold text-blue-400 mr-2">{lang.toUpperCase()}</span>{sub.translations[lang]}</div>) : null))}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-60">
                    <p className="mb-2 font-bold">字幕データがありません</p>
                    <p className="text-xs">この動画には字幕がないか、取得に失敗しました。</p>
                  </div>
                )}
              </div>
            </div>
            <VoiceRecorder targetText={manualTargetText || subtitles.find(s => { const start = s.offset / 1000; const end = start + (s.duration / 1000); return currentTime >= start && currentTime < end; })?.text || ""} />
            <CommentSection videoId={videoId} />
          </div>
        </div>

        {/* PCビュー */}
        <div className="hidden md:flex w-full h-full max-w-6xl mx-auto p-6 gap-6">
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {!isKids && userId && <Heatmap userId={userId} />}
            <div className={`relative aspect-video rounded-lg overflow-hidden shadow-xl bg-black ${isAudioOnly ? 'h-12' : ''}`}>
              {!isAudioOnly && <YouTube videoId={videoId} onReady={onReady} opts={{ width: '100%', height: '100%' }} className="absolute top-0 left-0 w-full h-full" />}
            </div>
            <button onClick={() => setIsAudioOnly(!isAudioOnly)} className="w-full py-2 bg-gray-200 text-sm font-bold rounded">Switch to Audio Only</button>
            <div className={`${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-xl shadow-sm border overflow-hidden`}>
              <VoiceRecorder targetText={manualTargetText || subtitles.find(s => { const start = s.offset / 1000; const end = start + (s.duration / 1000); return currentTime >= start && currentTime < end; })?.text || ""} />
            </div>
            <CommentSection videoId={videoId} />
          </div>

          <div className={`w-1/3 rounded-lg shadow-lg border h-full flex flex-col ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
            <div className="p-4 border-b flex justify-between items-center relative">
              <h2 className="text-sm font-bold opacity-50">Transcript</h2>
              <div className="flex items-center gap-2">
                {isTranslating && <span className="text-xs text-blue-500 animate-pulse">Generating...</span>}
                <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  🌐 翻訳 ({selectedLangs.length}) {isLangMenuOpen ? '▲' : '▼'}
                </button>
              </div>
              {isLangMenuOpen && (
                <div className="absolute right-4 top-12 bg-white shadow-xl border rounded-xl p-3 z-50 w-48 text-black">
                  <p className="text-xs text-gray-400 mb-2 font-bold">最大3つまで選択可能</p>
                  <div className="space-y-1">
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => toggleLanguage(lang.code)} className={`w-full text-left px-2 py-2 rounded text-sm flex justify-between items-center ${selectedLangs.includes(lang.code) ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-50'}`}>
                        <span>{lang.label}</span>{selectedLangs.includes(lang.code) && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* 字幕リスト (PC) */}
              {isSubtitleLoading ? (
                <div className="text-center py-10 text-gray-500 animate-pulse">字幕データを取得中...</div>
              ) : subtitles.length > 0 ? (
                subtitles.map((sub, i) => (
                  <div key={i} onClick={() => { handleSeek(sub.offset); setManualTargetText(sub.text); }} className={`cursor-pointer p-3 rounded text-lg leading-relaxed transition-colors border-b ${isPro ? 'border-gray-700 hover:bg-gray-700 text-gray-300' : 'border-gray-50 hover:bg-gray-100 text-gray-700'} ${manualTargetText === sub.text ? (isPro ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-green-50 border-l-4 border-green-500') : ''}`}>
                    <div>{(sub.text || '').split(' ').map((word, wIndex) => (<span key={wIndex} onClick={(e) => handleWordClick(word, e)} className={`inline-block mx-0.5 px-0.5 rounded ${word.length >= 6 ? 'text-blue-500 font-bold' : ''}`}>{word}</span>))}</div>
                    {showTranslation && sub.translation && (<div className="mt-2 text-base text-blue-600 font-bold">{sub.translation}</div>)}
                    {selectedLangs.map(lang => (sub.translations && sub.translations[lang] ? (<div key={lang} className="text-base text-gray-500 mt-2 border-l-2 border-blue-200 pl-2"><span className="text-xs font-bold text-blue-400 mr-2">{lang.toUpperCase()}</span>{sub.translations[lang]}</div>) : null))}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 opacity-60">
                  <p className="mb-2 font-bold">字幕データがありません</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedWord && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSelectedWord(null)} />
          <div className={`fixed z-50 shadow-2xl border-gray-200 bottom-0 left-0 w-full rounded-t-2xl p-6 border-t animate-slide-up md:top-20 md:right-10 md:w-80 md:rounded-xl md:border md:bottom-auto md:left-auto md:p-6 ${isPro ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-black'}`}>
            <div className="flex justify-between items-start mb-4 border-b pb-2"><h3 className="text-3xl font-bold capitalize">{selectedWord}</h3><button onClick={() => setSelectedWord(null)} className="text-2xl opacity-50">×</button></div>
            {isLoading ? <p>Loading...</p> : dictData ? (
              <div className="space-y-4">
                <p className="text-sm font-bold text-gray-500">
                  {dictData.sourceLang} → 日本語翻訳
                  {dictData.sourceLang === 'English' && dictData.audio && (
                    <button onClick={playAudio} className="ml-2 text-blue-500 hover:text-blue-600 text-base">🔊</button>
                  )}
                </p>
                <p className="text-xl font-bold">{dictData.translation}</p>

                {/* 安全チェック強化 */}
                {dictData.sourceLang === 'English' && dictData.meanings && dictData.meanings.length > 0 && dictData.meanings[0].definitions && dictData.meanings[0].definitions.length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-bold text-gray-400">English Definition:</p>
                    <p className="text-sm opacity-80">{dictData.meanings[0].definitions[0].definition}</p>
                  </div>
                )}

                <button onClick={handleSaveWord} disabled={isSaving} className={`w-full py-3 rounded-lg font-bold shadow-lg ${isSaving ? 'bg-gray-500' : 'bg-green-600 text-white'}`}>{isSaving ? 'Saving...' : '＋ Save'}</button>
              </div>
            ) : <p>No data</p>}
          </div>
        </>
      )}
      {isSearchOpen && <InternalVideoSearchModal onClose={() => setIsSearchOpen(false)} onSelect={(id: string) => { setVideoId(id); setIsSearchOpen(false); setTimeout(() => loadVideo(id), 100); }} currentSubject={userProfile.learning_target} />}

      {userId && <AIChatButton userId={userId} />}
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