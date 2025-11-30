'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
// import YouTube, { YouTubePlayer } from 'react-youtube'; // Removed
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
import VideoSearchModal from '@/components/VideoSearchModal';
import { SUPPORTED_LANGUAGES } from '@/lib/constants';
import { ExternalLink, AlertCircle, HelpCircle } from 'lucide-react';

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
  study_guide_langs: string[]; // Added
};

const CEFR_LEVELS = [
  'A1 (Beginner)', 'A2 (Elementary)', 'B1 (Intermediate)', 'B2 (Upper Intermediate)',
  'C1 (Advanced)', 'C2 (Master)'
];

const XP_CAP = 1000;

interface PlayerAreaProps {
  videoId: string;
  isAudioOnly: boolean;
  setIsAudioOnly: (value: boolean) => void;
  playError: boolean;
  setPlayError: (value: boolean) => void;
  onPlayerReady: (player: any) => void;
}

const PlayerArea = ({ videoId, isAudioOnly, setIsAudioOnly, playError, setPlayError, onPlayerReady }: PlayerAreaProps) => {
  const playerRef = useRef<any | null>(null);

  useEffect(() => {
    if (playError || isAudioOnly) return;

    const initPlayer = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        try {
          if (playerRef.current) {
            try { playerRef.current.destroy(); } catch (e) { console.error(e); }
          }

          playerRef.current = new (window as any).YT.Player('youtube-player', {
            events: {
              'onReady': (e: any) => onPlayerReady(e.target),
              'onError': (e: any) => {
                console.warn("YouTube Player Error:", e.data);
                setPlayError(true);
              }
            }
          });
        } catch (e) {
          console.error("Player init error", e);
        }
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) { console.error(e); }
      }
    };
  }, [videoId, playError, isAudioOnly, onPlayerReady, setPlayError]);

  return (
    <div className={`relative aspect-video rounded-lg overflow-hidden shadow-xl bg-black ${isAudioOnly ? 'h-12' : ''} relative group`}>
      {playError ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center z-10">
          <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
          <h3 className="text-xl font-bold mb-2">埋め込み再生できません</h3>
          <p className="text-sm text-gray-400 mb-6">YouTube公式で視聴してください。</p>
          <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 transition transform hover:scale-105">
            <ExternalLink size={20} /> YouTubeで開く
          </a>
        </div>
      ) : isAudioOnly ? (
        <div className="w-full h-full flex items-center justify-center text-white text-xs cursor-pointer" onClick={() => setIsAudioOnly(false)}>🙈 Audio Only (Tap)</div>
      ) : (
        <iframe
          id="youtube-player"
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=0&enablejsapi=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      )}

      {!playError && !isAudioOnly && (
        <button
          onClick={() => setPlayError(true)}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full z-20 backdrop-blur-sm transition opacity-70 hover:opacity-100"
          title="動画が再生できない場合はこちら (YouTubeで開く)"
        >
          <HelpCircle size={24} />
        </button>
      )}
    </div>
  );
};

interface TranscriptListProps {
  isSubtitleLoading: boolean;
  subtitles: Subtitle[];
  isPro: boolean;
  manualTargetText: string | null;
  setManualTargetText: (text: string | null) => void;
  handleSeek: (ms: number) => void;
  handleWordClick: (word: string, e: React.MouseEvent) => void;
  showTranslation: boolean;
  selectedLangs: string[];
}

const TranscriptList = ({
  isSubtitleLoading,
  subtitles,
  isPro,
  manualTargetText,
  setManualTargetText,
  handleSeek,
  handleWordClick,
  showTranslation,
  selectedLangs
}: TranscriptListProps) => (
  <div className="space-y-3">
    {isSubtitleLoading ? (
      <div className="text-center py-10 text-gray-500 animate-pulse">字幕データを取得中...</div>
    ) : subtitles.length > 0 ? (
      subtitles.map((sub, i) => (
        <div key={i} onClick={() => { handleSeek(sub.offset); setManualTargetText(sub.text); }} className={`cursor-pointer p-3 rounded text-base leading-relaxed transition-colors border-b ${isPro ? 'border-gray-700 hover:bg-gray-700 text-gray-300' : 'border-gray-50 hover:bg-gray-100 text-gray-700'} ${manualTargetText === sub.text ? (isPro ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-green-50 border-l-4 border-green-500') : ''}`}>
          <div className="mb-1">{(sub.text || '').split(' ').map((word, wIndex) => (<span key={wIndex} onClick={(e) => handleWordClick(word, e)} className={`inline-block mx-0.5 px-0.5 rounded ${word.length >= 6 ? 'text-blue-500 font-bold' : ''}`}>{word}</span>))}</div>
          {showTranslation && sub.translation && (<div className="mt-1 text-sm text-blue-600 font-bold">{sub.translation}</div>)}
          {selectedLangs.map(lang => (sub.translations && sub.translations[lang] ? (<div key={lang} className="text-sm text-gray-500 mt-1 border-l-2 border-blue-200 pl-2"><span className="text-xs font-bold text-blue-400 mr-1">{lang.toUpperCase()}:</span>{sub.translations[lang]}</div>) : null))}
        </div>
      ))
    ) : (
      <div className="text-center py-10 opacity-60">
        <p className="mb-2 font-bold">字幕データがありません</p>
        <p className="text-xs">Adminで生成されているか確認してください。</p>
      </div>
    )}
  </div>
);

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramVideoId = searchParams.get('videoId');
  const initialVideoId = 'arj7oStGLkU';

  // ユーザー情報
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: '', level: 1, xp: 0, next_level_xp: 100, theme: 'student', goal: '', placement_test_done: true, learning_target: 'English', study_guide_langs: ['Japanese']
  });

  const [currentLevelData, setCurrentLevelData] = useState<UserLevelData>({
    user_id: '', subject: 'English', level_result: 'A1 (Beginner)', score: 0, xp: 0
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPlacementTest, setShowPlacementTest] = useState(false);

  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [explanationLangs, setExplanationLangs] = useState<string[]>(['Japanese']); // Array of langs

  // Summary Interactive State
  const [userSummary, setUserSummary] = useState('');
  const [summaryFeedback, setSummaryFeedback] = useState<string | null>(null);
  const [isCheckingSummary, setIsCheckingSummary] = useState(false);
  const [showModelSummary, setShowModelSummary] = useState(false);

  const [videoId, setVideoId] = useState(initialVideoId);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [studyGuides, setStudyGuides] = useState<Record<string, any>>({}); // Map of guides
  const playerRef = useRef<any | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // ... (other state)

  // ...

  const onReady = useCallback((target: any) => {
    if (target && typeof target.playVideo === 'function') {
      playerRef.current = target;
      setPlayError(false);
      const start = searchParams.get('start');
      if (start) { target.seekTo(parseInt(start), true); target.playVideo(); }
    }
  }, [searchParams]);

  // ...

  const handleSeek = (ms: number) => {
    const p = playerRef.current;
    if (p && typeof p.seekTo === 'function') {
      p.seekTo(ms / 1000, true);
      p.playVideo();
    }
  };

  useEffect(() => {
    const i = setInterval(() => {
      const p = playerRef.current;
      if (p && typeof p.getPlayerState === 'function' && p.getPlayerState() === 1) {
        setCurrentTime(p.getCurrentTime());
      }
    }, 100);
    return () => clearInterval(i);
  }, []); // No dependency on player

  // ...

  // プレイヤーの初期化（APIロード後または再レンダリング時）


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
  const [editGoal, setEditGoal] = useState('');
  const [editLangs, setEditLangs] = useState<string[]>([]);
  const [editTheme, setEditTheme] = useState<'kids' | 'student' | 'pro'>('student');

  // AI翻訳用キャッシュ管理
  const [targetLang, setTargetLang] = useState('ja');
  const [loadedLang, setLoadedLang] = useState<string | null>(null);
  const [isSubtitleLoading, setIsSubtitleLoading] = useState(false);
  const [playError, setPlayError] = useState(false);

  // ★画面サイズ判定用
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadedVideoIdRef = useRef<string | null>(null);

  const getThemeStyles = () => {
    switch (userProfile.theme) {
      case 'kids': return 'font-sans text-lg bg-yellow-50 text-gray-900';
      case 'pro': return 'font-mono text-sm bg-gray-900 text-gray-100';
      default: return 'font-sans text-base bg-gray-50 text-gray-800';
    }
  };

  // ★画面サイズ監視
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        fetchProfile(session.user.id);
      } else {
        // Guest Mode
        setUserId(null);
        setUserEmail(null);
        setUsername('Guest');
        setEditName('Guest');
        setEditGoal('Try the app!');
        setEditLangs(['Japanese']);
        setUserProfile({
          id: 'guest', level: 1, xp: 0, next_level_xp: 100, theme: 'student', goal: 'Try the app!', placement_test_done: true, learning_target: 'English', study_guide_langs: ['Japanese']
        });
        return;
      }
      setUserId(session.user.id);
      fetchProfile(session.user.id);
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadVideo = useCallback(async (id: string, expLangs: string[] = ['Japanese']) => {
    if (id === loadedVideoIdRef.current && JSON.stringify(expLangs) === JSON.stringify(explanationLangs)) return;
    loadedVideoIdRef.current = id;

    setVideoId(id);
    setExplanationLangs(expLangs); // Update state
    setSubtitles([]); setDictData(null); setSelectedWord(null); setManualTargetText(null);
    setSelectedLangs([]); setLoadedLang(null); setShowTranslation(false);
    setIsSubtitleLoading(true);
    setPlayError(false);
    setStudyGuides({}); // Reset

    // Reset Summary State
    setUserSummary('');
    setSummaryFeedback(null);
    setIsCheckingSummary(false);
    setShowModelSummary(false);

    // Helper to fetch/generate one guide
    const fetchGuide = async (lang: string) => {
      try {
        const { data: guide } = await supabase
          .from('video_study_guides')
          .select('*')
          .match({ video_id: id, explanation_lang: lang })
          .single();

        if (guide) return { lang, data: guide };

        // Auto-generate
        console.log(`No study guide found for ${lang}. Auto-generating...`);
        const genRes = await fetch('/api/study_guide/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id, subject: userProfile.learning_target, explanationLang: lang })
        });
        console.log(`[Frontend] API Status (${lang}): ${genRes.status}`);
        const genData = await genRes.json();
        if (genData.success && genData.data) {
          return { lang, data: genData.data };
        } else {
          console.error(`Failed to auto-generate guide for ${lang}:`, genData);
          return { lang, error: genData.error };
        }
      } catch (e) {
        console.error(`Auto-gen error for ${lang}`, e);
        return { lang, error: e };
      }
    };

    try {
      // 1. Fetch all guides in parallel
      setIsGeneratingGuide(true);
      const results = await Promise.all(expLangs.map(lang => fetchGuide(lang)));

      const newGuides: Record<string, any> = {};
      results.forEach(res => {
        if (res && res.data) {
          newGuides[res.lang] = res.data;
        }
      });
      setStudyGuides(newGuides);
      setIsGeneratingGuide(false);

      // 2. Fetch Subtitles (Plan A: youtube-transcript)ill want them for internal logic (like word click), 
      // but we are hiding the TranscriptList. 
      // For now, let's NOT fetch raw transcripts to be safe, or just fetch them for the "VoiceRecorder" context if needed.
      // The user wants to avoid "displaying" them.
      // I will skip fetching subtitles to be 100% safe as per user request.

    } catch (e) { console.error('通信エラー', e); }
    finally { setIsSubtitleLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explanationLangs, userProfile.learning_target]);

  useEffect(() => {
    const targetId = paramVideoId || initialVideoId;
    if (targetId && targetId !== loadedVideoIdRef.current) {
      loadVideo(targetId);
    }
  }, [paramVideoId, initialVideoId, loadVideo]);

  const fetchProfile = async (uid: string) => {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (profileData) {
      setUserProfile(profileData as UserProfile);
      setUsername(profileData.username || 'Hero');
      setEditName(profileData.username || 'Hero');
      setEditGoal(profileData.goal || '');
      setEditLangs(profileData.study_guide_langs || ['Japanese']);
      setEditTheme(profileData.theme || 'student');
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
      setUserProfile(prev => ({ ...prev, learning_target: newLang }));

      // Sync Study Guide Language (Use newLang as primary, keep others if they exist, or just reset to newLang?)
      // User likely wants to see explanations in their new target language.
      // Let's just set it to [newLang] for simplicity, or add it?
      // "studyguideの言語も対象言語と同じ言語にしたい" -> Set to [newLang]
      setExplanationLangs([newLang]);
      loadVideo(videoId, [newLang]);

      // Reload to refresh other components if needed (or just state update is enough?)
      // window.location.reload(); // Let's try to avoid reload for smoother UX
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

  const handleSaveSettings = async (newTheme: 'kids' | 'student' | 'pro', newGoal: string, newLangs: string[], newName: string) => {
    // Guest Mode: Update local state only
    if (!userId) {
      setUserProfile(prev => ({ ...prev, theme: newTheme, goal: newGoal, study_guide_langs: newLangs }));
      setUsername(newName);
      setIsSettingsOpen(false);
      return;
    }
    try {
      await supabase.from('profiles').update({ theme: newTheme, goal: newGoal, study_guide_langs: newLangs, username: newName }).eq('id', userId);
      setUserProfile(prev => ({ ...prev, theme: newTheme, goal: newGoal, study_guide_langs: newLangs }));
      setUsername(newName);
      setIsSettingsOpen(false);
    } catch (e) { alert('設定の保存に失敗しました'); }
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
        const aiRes = await fetch('/api/ai/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: cleanWord, targetLang: userProfile.learning_target })
        });
        const data = await aiRes.json();
        setDictData({
          word: cleanWord, translation: data.translation || "翻訳できませんでした",
          sourceLang: data.sourceLang, meanings: []
        });
      } catch { setDictData({ word: cleanWord, translation: "エラー", sourceLang: userProfile.learning_target }); }
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



  const handleCheckSummary = async () => {
    if (!userSummary.trim()) return;
    setIsCheckingSummary(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `You are a language teacher. The user has written a summary of a video. Compare it to the model answer: "${Object.values(studyGuides)[0]?.summary}". Give a score (0-100) and brief feedback in ${explanationLangs[0]}.` },
            { role: 'user', content: userSummary }
          ]
        })
      });
      const data = await res.json();
      setSummaryFeedback(data.response);
      setShowModelSummary(true);
    } catch (e) {
      alert('Evaluation failed');
    } finally {
      setIsCheckingSummary(false);
    }
  };

  if (!userId || !mounted) return <div className="p-10 text-center">Loading...</div>;
  const isPro = userProfile.theme === 'pro';
  const isKids = userProfile.theme === 'kids';

  // コンポーネント: 字幕リスト








  const playAudio = () => dictData?.audio && new Audio(dictData.audio).play();
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/auth'); };

  const renderStudyGuide = () => (
    <div className={`${isMobile ? 'w-full h-auto mt-6' : 'w-1/3 h-full'} rounded-lg shadow-lg border flex flex-col ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
      {/* PC用ヘッダー */}
      <div className="p-4 border-b flex justify-between items-start relative border-gray-700">
        <div>
          <h2 className="text-sm font-bold opacity-70 mb-1">Study Guide</h2>
          <p className="text-xs opacity-50">Langs (Max 3):</p>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {SUPPORTED_LANGUAGES.map(lang => {
            const isSelected = explanationLangs.includes(lang.dbName);
            return (
              <button
                key={lang.code}
                onClick={() => {
                  let newLangs = [...explanationLangs];
                  if (isSelected) {
                    if (newLangs.length > 1) newLangs = newLangs.filter(l => l !== lang.dbName);
                  } else {
                    if (newLangs.length < 3) newLangs.push(lang.dbName);
                  }
                  loadVideo(videoId, newLangs);
                }}
                className={`w-6 h-6 flex items-center justify-center rounded text-xs transition ${isSelected ? 'bg-indigo-600 ring-1 ring-indigo-400 grayscale-0' : 'bg-gray-700 grayscale opacity-50 hover:opacity-100'}`}
                title={lang.label}
              >
                {lang.label.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`${isMobile ? '' : 'flex-1 overflow-y-auto'} p-4`}>
        {Object.keys(studyGuides).length > 0 ? (
          <div className="space-y-6">
            {/* Summary Challenge (Shared) */}
            <div className={`p-4 rounded-lg border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-indigo-50 border-indigo-100'}`}>
              <h3 className={`font-bold mb-2 ${isPro ? 'text-indigo-300' : 'text-indigo-700'}`}>📝 Summary Challenge</h3>

              {!showModelSummary ? (
                <div className="space-y-3">
                  <p className={`text-sm ${isPro ? 'text-gray-300' : 'text-gray-600'}`}>
                    Watch the video and write a 3-sentence summary!
                  </p>
                  <textarea
                    value={userSummary}
                    onChange={(e) => setUserSummary(e.target.value)}
                    className={`w-full p-3 rounded border text-sm ${isPro ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-black'}`}
                    rows={3}
                    placeholder="Type your summary here..."
                  />
                  <button
                    onClick={handleCheckSummary}
                    disabled={isCheckingSummary || !userSummary.trim()}
                    className={`w-full py-2 rounded font-bold text-white transition ${isCheckingSummary ? 'bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                  >
                    {isCheckingSummary ? 'Analyzing...' : 'Check My Summary'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className={`p-3 rounded border ${isPro ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <p className="text-xs font-bold opacity-50 mb-1">Your Summary</p>
                    <p className={`text-sm ${isPro ? 'text-gray-300' : 'text-gray-800'}`}>{userSummary}</p>
                  </div>

                  <div className={`p-3 rounded border border-l-4 ${isPro ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-500'}`}>
                    <p className="text-xs font-bold text-blue-500 mb-1">AI Feedback</p>
                    <p className={`text-sm ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{summaryFeedback}</p>
                  </div>

                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-xs font-bold opacity-50 mb-2">Model Answers</p>
                    <div className="space-y-2">
                      {explanationLangs.map(lang => studyGuides[lang] && (
                        <div key={lang} className={`p-3 rounded border ${isPro ? 'bg-cyan-900/40 border-cyan-800' : 'bg-white border-gray-200'}`}>
                          <p className="text-xs font-bold mb-1 opacity-70 text-cyan-400">{lang}</p>
                          <p className={`text-sm leading-relaxed ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{studyGuides[lang].summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowModelSummary(false)}
                    className="text-xs text-gray-500 underline hover:text-gray-700"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Grouped by Section Content */}
            <div className="space-y-8">

              {/* Key Sentences Section */}
              <div>
                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-yellow-400' : 'text-indigo-700'}`}>
                  🔑 Key Sentences
                </h3>
                <div className="space-y-6">
                  {(() => {
                    const masterLang = explanationLangs.find(l => studyGuides[l]);
                    const masterGuide = masterLang ? studyGuides[masterLang] : null;

                    if (!masterGuide?.key_sentences) return <p className="text-sm opacity-50">No key sentences found.</p>;

                    return masterGuide.key_sentences.map((masterItem: any, index: number) => (
                      <div key={index} className={`p-5 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                        {/* Original Sentence */}
                        <div className="mb-4 flex justify-between items-start gap-4">
                          <p className={`font-bold text-lg leading-relaxed ${isPro ? 'text-white' : 'text-gray-900'}`}>{masterItem.sentence}</p>
                          <button
                            onClick={() => {
                              setManualTargetText(masterItem.sentence);
                              // スマホの場合は上部のレコーダーまでスクロールした方が親切かも？
                              // いったんシンプルにセットのみ
                            }}
                            className="shrink-0 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white px-3 py-1.5 rounded-full shadow-md transition transform hover:scale-105 text-xs font-bold flex items-center gap-1"
                            title="Shadowing Practice"
                          >
                            🎙️ Shadow
                          </button>
                        </div>

                        {/* Explanations per Language (Stacked) */}
                        <div className="flex flex-col gap-2">
                          {explanationLangs.map(lang => {
                            const guide = studyGuides[lang];
                            const item = guide?.key_sentences?.[index] || guide?.key_sentences?.find((s: any) => s.sentence === masterItem.sentence);

                            if (!item) return null;

                            return (
                              <div key={lang} className={`p-3 rounded-lg border-l-4 ${isPro ? 'bg-cyan-900/30 border-cyan-600' : 'bg-gray-50 border-indigo-400'}`}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`text-xs font-bold ${isPro ? 'text-cyan-400' : 'text-indigo-600'}`}>{SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label}</span>
                                </div>
                                <p className={`text-sm mb-2 ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{item.translation}</p>
                                <p className={`text-xs ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>💡 {item.explanation}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Vocabulary Section */}
              <div>
                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-green-400' : 'text-indigo-700'}`}>
                  📚 Vocabulary
                </h3>
                <div className="space-y-4">
                  {(() => {
                    const masterLang = explanationLangs.find(l => studyGuides[l]);
                    const masterGuide = masterLang ? studyGuides[masterLang] : null;

                    if (!masterGuide?.vocabulary) return <p className="text-sm opacity-50">No vocabulary found.</p>;

                    return masterGuide.vocabulary.map((masterItem: any, index: number) => (
                      <div key={index} className={`p-4 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <p className={`font-bold text-lg ${isPro ? 'text-white' : 'text-gray-900'}`}>{masterItem.word}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!userId) {
                                alert("Please login to save vocabulary!");
                                return;
                              }
                              setDictData({ word: masterItem.word, translation: masterItem.meaning, sourceLang: userProfile.learning_target });
                              const save = async () => {
                                if (!userId) return;
                                try {
                                  await supabase.from('vocab').insert([{ user_id: userId, word: masterItem.word, translation: masterItem.meaning, subject: userProfile.learning_target }]);
                                  await addXp(10); alert(`Saved: ${masterItem.word} (+10 XP)`);
                                } catch { alert('Save failed'); }
                              };
                              save();
                            }}
                            className={`text-xs px-2 py-1 rounded transition ${userId ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                          >
                            {userId ? '＋ Save' : '🔒 Save'}
                          </button>
                        </div>

                        <div className="flex flex-col gap-2">
                          {explanationLangs.map(lang => {
                            const guide = studyGuides[lang];
                            const item = guide?.vocabulary?.[index] || guide?.vocabulary?.find((v: any) => v.word === masterItem.word);

                            if (!item) return null;

                            return (
                              <div key={lang} className={`p-2 rounded border-l-4 ${isPro ? 'bg-gray-700/50 border-gray-500' : 'bg-gray-50 border-gray-300'}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>{SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label.split(' ')[0]}</span>
                                  <span className={`text-sm ${isPro ? 'text-gray-200' : 'text-gray-700'}`}>{item.meaning}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Grammar Section */}
              <div>
                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-pink-400' : 'text-indigo-700'}`}>
                  📐 Grammar
                </h3>
                <div className="space-y-4">
                  {(() => {
                    const masterLang = explanationLangs.find(l => studyGuides[l]);
                    const masterGuide = masterLang ? studyGuides[masterLang] : null;

                    if (!masterGuide?.grammar) return <p className="text-sm opacity-50">No grammar points found.</p>;

                    return masterGuide.grammar.map((masterItem: any, index: number) => (
                      <div key={index} className={`p-4 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <p className={`font-bold text-lg mb-3 ${isPro ? 'text-pink-300' : 'text-pink-700'}`}>{masterItem.point}</p>

                        <div className="flex flex-col gap-2">
                          {explanationLangs.map(lang => {
                            const guide = studyGuides[lang];
                            const item = guide?.grammar?.[index] || guide?.grammar?.find((g: any) => g.point === masterItem.point);

                            if (!item) return null;

                            return (
                              <div key={lang} className={`p-3 rounded border-l-4 ${isPro ? 'bg-pink-900/20 border-pink-600' : 'bg-pink-50 border-pink-300'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold ${isPro ? 'text-pink-400' : 'text-pink-600'}`}>{SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label}</span>
                                </div>
                                <p className={`text-sm ${isPro ? 'text-gray-300' : 'text-gray-600'}`}>{item.explanation}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Quiz Section */}
              <div>
                <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isPro ? 'text-orange-400' : 'text-indigo-700'}`}>
                  🧩 Quiz
                </h3>
                <div className="grid grid-cols-1 gap-6">
                  {explanationLangs.map(lang => {
                    const guide = studyGuides[lang];
                    if (!guide?.quiz) return null;
                    return (
                      <div key={lang} className={`p-4 rounded-xl border ${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <h4 className="font-bold text-sm mb-4 opacity-70 flex items-center gap-2 border-b border-gray-700 pb-2">
                          {SUPPORTED_LANGUAGES.find(l => l.dbName === lang)?.label}
                        </h4>
                        <div className="space-y-6">
                          {guide.quiz.map((q: any, i: number) => (
                            <div key={i} className="text-sm">
                              <p className={`font-bold mb-2 text-base ${isPro ? 'text-gray-200' : 'text-gray-800'}`}>Q{i + 1}. {q.question}</p>
                              <div className="pl-2 space-y-2">
                                {q.options?.map((opt: string, oi: number) => (
                                  <div key={oi} className={`p-2 rounded border ${isPro ? 'border-gray-700 bg-gray-900/50 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                                    {opt === q.answer ? '✅' : '⚪️'} {opt}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div >
        ) : isGeneratingGuide ? (
          <div className="text-center py-10 animate-pulse">
            <p className="text-2xl mb-2">🤖</p>
            <p className="font-bold text-indigo-600">Generating Study Guide...</p>
            <p className="text-xs text-gray-500">AI is analyzing the video content for you.</p>
          </div>
        ) : (
          <div className="text-center py-10 opacity-60">
            <p className="mb-2 font-bold">Study Guide Not Found</p>
            <p className="text-xs">Could not generate guide for this video.</p>
          </div>
        )
        }
      </div >
    </div >
  );

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
          <div className="flex items-center gap-2">
            <select
              value={userProfile.learning_target}
              onChange={(e) => handleTargetLanguageChange(e.target.value)}
              className={`text-sm font-bold border-none bg-transparent cursor-pointer hover:opacity-70 transition ${isPro ? 'text-white' : 'text-gray-800'}`}
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.label.split(' ')[1] || lang.code} className="text-black">
                  {lang.label}
                </option>
              ))}
            </select>
            <div className="scale-75 origin-left">
              <UserStatus level={currentLevelData.level_result.split(' ')[0] || '1'} xp={currentLevelData.xp} nextLevelXp={XP_CAP} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!userId && (
            <Link href="/auth" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-bold shadow transition">
              Login
            </Link>
          )}
          <button onClick={() => setIsSettingsOpen(true)} className="text-xl p-1 hover:opacity-70 transition">⚙️</button>
        </div>
      </div>

      {/* 設定パネル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>

            {/* Appearance */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">Appearance</h3>
              <div className="flex gap-2">
                {['kids', 'student', 'pro'].map(t => (
                  <button key={t} onClick={() => setEditTheme(t as any)} className={`flex-1 py-2 rounded-lg border font-bold capitalize transition ${editTheme === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Learning Profile */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">Learning Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Current Goal</label>
                  <input
                    type="text"
                    value={editGoal}
                    onChange={(e) => setEditGoal(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="e.g. Master daily conversation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">Study Guide Languages</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          if (editLangs.includes(lang.dbName)) {
                            setEditLangs(prev => prev.filter(l => l !== lang.dbName));
                          } else {
                            if (editLangs.length < 3) setEditLangs(prev => [...prev, lang.dbName]);
                          }
                        }}
                        className={`p-2 rounded border text-sm text-left flex justify-between items-center transition ${editLangs.includes(lang.dbName) ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        <span>{lang.label}</span>
                        {editLangs.includes(lang.dbName) && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Select up to 3 languages for explanations.</p>
                </div>
              </div>
            </div>

            {/* Account */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">Account</h3>
              <div className="space-y-4">
                {userEmail && (
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-700">Email</label>
                    <input
                      type="text"
                      value={userEmail}
                      readOnly
                      className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
                {userId && (
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to logout?')) {
                        await supabase.auth.signOut();
                        window.location.reload();
                      }
                    }}
                    className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition flex items-center justify-center gap-2"
                  >
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">
                Cancel
              </button>
              <button
                onClick={() => handleSaveSettings(editTheme, editGoal, editLangs, editName)}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サブメニュー */}
      <div className={`shrink-0 w-full flex gap-2 overflow-x-auto p-2 border-b ${isPro ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-gray-50 border-gray-200'}`}>
        <Link href="/dashboard" className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">📊 Dashboard</Link>
        <button onClick={() => setIsSearchOpen(true)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">🔍 検索</button>
        <Link href="/vocab" className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">📚 単語</Link>
        <Link href="/drill" className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">🔥 ドリル</Link>
        <Link href="/textbook" className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">📖 教科書</Link>
        <Link href="/reading" className="bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">📚 読み物</Link>
        <Link href="/typetalk" className="bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">⌨️ 会話</Link>
        <Link href="/writing" className="bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">✍️ 英作文</Link>
        <Link href="/podcast" className="bg-pink-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap">🎧 Podcast</Link>
      </div>

      {/* === レイアウト本体 === */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* スマホビュー */}
        {isMobile && (
          <div className="flex flex-col h-full w-full">
            <PlayerArea videoId={videoId} isAudioOnly={isAudioOnly} setIsAudioOnly={setIsAudioOnly} playError={playError} setPlayError={setPlayError} onPlayerReady={onReady} />
            {!isAudioOnly && !playError && <button onClick={() => setIsAudioOnly(true)} className="shrink-0 w-full py-2 bg-gray-200 text-xs font-bold text-gray-600 border-b">🙉 Audio Only</button>}

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
              <VoiceRecorder targetText={manualTargetText || subtitles.find(s => { const start = s.offset / 1000; const end = start + (s.duration / 1000); return currentTime >= start && currentTime < end; })?.text || ""} />
              {renderStudyGuide()}
              <CommentSection videoId={videoId} />
            </div>
          </div>
        )}

        {/* PCビュー */}
        {!isMobile && (
          <div className="flex w-full h-full max-w-6xl mx-auto p-6 gap-6">
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {!isKids && userId && <Heatmap userId={userId} />}
              {!userId && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-sm text-blue-800 font-bold mb-2">👋 Welcome Guest!</p>
                  <p className="text-xs text-blue-600 mb-2">Sign in to save your progress and vocabulary.</p>
                  <Link href="/auth" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-700 transition">Login / Sign Up</Link>
                </div>
              )}
              <PlayerArea videoId={videoId} isAudioOnly={isAudioOnly} setIsAudioOnly={setIsAudioOnly} playError={playError} setPlayError={setPlayError} onPlayerReady={onReady} />
              <button onClick={() => setIsAudioOnly(!isAudioOnly)} className="w-full py-2 bg-gray-200 text-sm font-bold rounded">Switch to Audio Only</button>
              <div className={`${isPro ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-xl shadow-sm border overflow-hidden`}>
                <VoiceRecorder targetText={manualTargetText || subtitles.find(s => { const start = s.offset / 1000; const end = start + (s.duration / 1000); return currentTime >= start && currentTime < end; })?.text || ""} />
              </div>
              <CommentSection videoId={videoId} />
            </div>

            {renderStudyGuide()}
          </div>
        )}
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

      {isSearchOpen && (
        <VideoSearchModal
          onClose={() => setIsSearchOpen(false)}
          currentSubject={userProfile.learning_target}
          onSelect={(id: string) => {
            setIsSearchOpen(false);
            // URLパラメータの更新と読み込みは useEffect に任せる
            router.push(`/?videoId=${id}`);
          }}
        />
      )}

      {userId && <AIChatButton userId={userId} />}

      <div className={`shrink-0 w-full p-4 border-t text-center text-xs text-gray-400 ${isPro ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <p>© 2025 Vidnitive. Created with ❤️ by <a href="#" className="hover:underline">Information Student</a>.</p>
      </div>
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