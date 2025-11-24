'use client';

import { useState, useEffect, Suspense } from 'react';
import YouTube, { YouTubePlayer } from 'react-youtube';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import VoiceRecorder from '@/components/VoiceRecorder';
import UserStatus from '@/components/UserStatus';
import CommentSection from '@/components/CommentSection';
import ProfileModal from '@/components/ProfileModal'; // プロフィール編集用モーダル

// --- 型定義 ---
type Subtitle = {
  text: string;
  offset: number;
  duration: number;
};

type DictionaryData = {
  word: string;
  phonetic?: string;
  audio?: string;
  translation?: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string }[];
  }[];
};

type UserProfile = {
  id: string;
  level: number;
  xp: number;
  next_level_xp: number;
};

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVideoId = searchParams.get('videoId') || 'arj7oStGLkU';

  // ユーザー情報
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('Hero'); // 表示名
  const [userProfile, setUserProfile] = useState<UserProfile>({ id: '', level: 1, xp: 0, next_level_xp: 100 });
  const [isProfileOpen, setIsProfileOpen] = useState(false); // 設定モーダルの開閉

  // 動画・プレイヤー関連
  const [videoId, setVideoId] = useState(initialVideoId);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // 辞書・学習機能関連
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [dictData, setDictData] = useState<DictionaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [manualTargetText, setManualTargetText] = useState<string | null>(null);

  // --- 1. ログインチェック & 初期データ取得 ---
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth');
        return;
      }

      setUserId(session.user.id);
      fetchProfile(session.user.id);

      if (initialVideoId) loadVideo();
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // プロフィール情報の取得
  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) {
      setUserProfile(data);
      setUsername(data.username || 'Hero'); // ユーザー名もセット
    }
  };

  // --- XP加算システム ---
  const addXp = async (amount: number) => {
    if (!userId) return;

    const { data: current } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!current) return;

    let newXp = current.xp + amount;
    let newLevel = current.level;
    let newNextXp = current.next_level_xp;
    let leveledUp = false;

    // レベルアップ計算
    if (newXp >= newNextXp) {
      newXp = newXp - newNextXp;
      newLevel += 1;
      newNextXp = Math.floor(newNextXp * 1.2);
      leveledUp = true;
    }

    // DB更新
    await supabase.from('profiles').update({
      level: newLevel, xp: newXp, next_level_xp: newNextXp
    }).eq('id', userId);

    // 画面更新
    setUserProfile({ ...current, level: newLevel, xp: newXp, next_level_xp: newNextXp });

    if (leveledUp) {
      alert(`🎉 LEVEL UP! You reached Lv.${newLevel}!`);
    }
  };

  // --- 動画 & 字幕読み込み ---
  const loadVideo = async () => {
    setSubtitles([]);
    setDictData(null);
    setSelectedWord(null);
    setManualTargetText(null);

    try {
      const res = await fetch(`/api/transcript?videoId=${videoId}`);
      const data = await res.json();

      if (data.error) {
        alert(`字幕取得エラー: ${data.error}`);
      } else {
        setSubtitles(data);
      }
    } catch (e) {
      console.error(e);
      alert('通信エラーが発生しました');
    }
  };

  // --- ライブラリ登録 ---
  const handleSaveToLibrary = async () => {
    if (!userId || subtitles.length === 0) return;
    const confirmSave = confirm('この動画をライブラリに登録しますか？');
    if (!confirmSave) return;

    setIsRegistering(true);

    try {
      // 重複チェック
      const { data: existing } = await supabase.from('library_videos')
        .select('id').eq('user_id', userId).eq('video_id', videoId).single();

      if (existing) {
        alert('すでに登録済みです');
        setIsRegistering(false);
        return;
      }

      // 動画情報登録
      const { error: videoError } = await supabase.from('library_videos').insert([{
        user_id: userId,
        video_id: videoId,
        title: `Video ${videoId}`,
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      }]);
      if (videoError) throw videoError;

      // 字幕データ登録
      const subtitleRows = subtitles.map(s => ({
        user_id: userId,
        video_id: videoId,
        text: s.text,
        start_time: s.offset / 1000,
        duration: s.duration / 1000
      }));

      const { error: subError } = await supabase.from('library_subtitles').insert(subtitleRows);
      if (subError) throw subError;

      await addXp(100);
      alert('ライブラリに登録しました！ (+100 XP)');

    } catch (e) {
      console.error(e);
      alert('登録失敗: ' + e);
    } finally {
      setIsRegistering(false);
    }
  };

  // --- 辞書 & 翻訳機能 ---
  const handleWordClick = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
    setSelectedWord(cleanWord);
    setDictData(null);
    setIsLoading(true);

    try {
      const [dictRes, transRes] = await Promise.all([
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`),
        fetch(`https://api.mymemory.translated.net/get?q=${cleanWord}&langpair=en|ja`)
      ]);

      let dictEntry = null;
      let translationText = "";

      if (dictRes.ok) {
        const data = await dictRes.json();
        dictEntry = data[0];
      }
      if (transRes.ok) {
        const data = await transRes.json();
        translationText = data.responseData.translatedText;
      }

      const audioEntry = dictEntry?.phonetics.find((p: any) => p.audio && p.audio !== '');
      setDictData({
        word: cleanWord,
        phonetic: dictEntry?.phonetic,
        audio: audioEntry ? audioEntry.audio : undefined,
        translation: translationText,
        meanings: dictEntry?.meanings.slice(0, 2) || [],
      });
    } catch (err) {
      console.error(err);
      setDictData({ word: cleanWord, meanings: [], translation: "データ取得エラー" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- 単語保存 ---
  const handleSaveWord = async () => {
    if (!userId || !dictData || !selectedWord) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('vocab').insert([{
        user_id: userId,
        word: dictData.word,
        translation: dictData.translation || '翻訳なし'
      }]);
      if (error) throw error;

      await addXp(10);
      alert(`「${dictData.word}」を保存しました！ (+10 XP)`);
    } catch (e) {
      console.error(e);
      alert('保存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // --- プレイヤー制御 ---
  const onReady = (event: { target: YouTubePlayer }) => {
    setPlayer(event.target);
    const startParam = searchParams.get('start');
    if (startParam) {
      event.target.seekTo(parseInt(startParam), true);
      event.target.playVideo();
    }
  };

  const handleSeek = (offsetMs: number) => {
    if (player) player.seekTo(offsetMs / 1000, true);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (player && player.getPlayerState() === 1) {
        setCurrentTime(player.getCurrentTime());
      }
    }, 100);
    return () => clearInterval(interval);
  }, [player]);

  const playAudio = () => {
    if (dictData?.audio) new Audio(dictData.audio).play();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (!userId) return <div className="p-10 text-center">Checking session...</div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-20 md:p-8 flex flex-col items-center">

      {/* --- ヘッダーエリア --- */}
      <div className="w-full max-w-6xl flex justify-between items-center p-4 md:p-0 md:mb-6 bg-white md:bg-transparent shadow-sm md:shadow-none sticky top-0 z-50 md:static">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800">My Dojo</h1>
        <div className="flex items-center gap-2">

          {/* ユーザー名表示 (PCのみ) */}
          <span className="hidden md:inline text-sm font-bold text-gray-600 mr-2">
            {username} さん
          </span>

          {/* ステータスバー */}
          <div className="scale-75 origin-right md:scale-100">
            <UserStatus level={userProfile.level} xp={userProfile.xp} nextLevelXp={userProfile.next_level_xp} />
          </div>

          {/* 設定ボタン (プロフィール編集) */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="text-xl p-1 hover:bg-gray-200 rounded-full transition"
            title="設定"
          >
            ⚙️
          </button>

          <button onClick={handleLogout} className="text-xs text-gray-500 underline ml-2">Logout</button>
        </div>
      </div>

      {/* --- サブメニュー (スマホ用) --- */}
      <div className="w-full flex gap-2 p-2 md:hidden overflow-x-auto bg-gray-50 border-b mb-2">
        <Link href="/search" className="bg-blue-500 text-white px-3 py-1 rounded text-sm font-bold whitespace-nowrap">🔍 検索</Link>
        <Link href="/vocab" className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold whitespace-nowrap">📚 単語帳</Link>
        <button
          onClick={handleSaveToLibrary}
          disabled={isRegistering || subtitles.length === 0}
          className="bg-purple-600 text-white px-3 py-1 rounded text-sm font-bold whitespace-nowrap disabled:bg-gray-300"
        >
          💾 保存
        </button>
      </div>

      {/* --- PC用メニュー --- */}
      <div className="hidden md:flex w-full max-w-6xl mb-6 gap-2">
        <input
          type="text"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          className="border p-2 rounded flex-1 text-black"
          placeholder="YouTube Video ID"
        />
        <button onClick={loadVideo} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-bold">Start</button>
        <button
          onClick={handleSaveToLibrary}
          disabled={isRegistering || subtitles.length === 0}
          className="ml-2 px-4 py-2 rounded font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400"
        >
          💾 ライブラリ登録
        </button>
        <Link href="/search" className="bg-blue-500 text-white px-4 py-2 rounded font-bold hover:bg-blue-600">🔍 検索</Link>
        <Link href="/vocab" className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">📚 単語帳</Link>
      </div>

      {/* --- 辞書ポップアップ (レスポンシブ) --- */}
      {selectedWord && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSelectedWord(null)} />
          <div className={`
            fixed z-50 bg-white shadow-2xl border-gray-200 text-black
            bottom-0 left-0 w-full rounded-t-2xl p-6 border-t animate-slide-up
            md:top-20 md:right-10 md:w-80 md:rounded-xl md:border md:bottom-auto md:left-auto md:p-6
          `}>
            <div className="flex justify-between items-start mb-4 border-b pb-2">
              <div>
                <h3 className="text-3xl font-bold text-blue-800 capitalize">{selectedWord}</h3>
                {dictData?.phonetic && <span className="text-gray-500 font-mono text-sm">{dictData.phonetic}</span>}
              </div>
              <button onClick={() => setSelectedWord(null)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl p-2">×</button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-4"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
              ) : dictData ? (
                <div className="space-y-4 pb-4">
                  {dictData.translation && (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <p className="text-xs text-gray-500 font-bold mb-1">日本語訳</p>
                      <p className="text-xl font-bold text-gray-800">{dictData.translation}</p>
                    </div>
                  )}
                  {dictData.audio && (
                    <button onClick={playAudio} className="w-full flex justify-center items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-lg font-bold transition">🔊 発音を聞く</button>
                  )}
                  {dictData.meanings.length > 0 && (
                    <div className="pr-2">
                      <p className="text-xs text-gray-400 font-bold mb-1 border-b">DEFINITION</p>
                      {dictData.meanings.map((m, i) => (
                        <div key={i} className="mb-2 mt-2">
                          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-2">{m.partOfSpeech}</span>
                          <ul className="list-disc pl-4 text-sm text-gray-600 mt-1">{m.definitions.slice(0, 1).map((d, j) => <li key={j}>{d.definition}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleSaveWord}
                    disabled={isSaving}
                    className={`w-full text-white py-3 rounded-lg font-bold shadow-lg transform transition ${isSaving ? 'bg-gray-400' : 'bg-green-600 active:scale-95'}`}
                  >
                    {isSaving ? '保存中...' : '＋ 単語帳に追加'}
                  </button>
                </div>
              ) : <p className="text-red-400">データなし</p>}
            </div>
          </div>
        </>
      )}

      {/* --- メインエリア --- */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full max-w-6xl px-4 md:px-0">

        {/* 左カラム: 動画、マイク、コメント */}
        <div className="flex-1 flex flex-col gap-4 sticky top-0 md:static z-30">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-xl shrink-0">
            <YouTube
              videoId={videoId}
              onReady={onReady}
              opts={{ width: '100%', height: '100%', playerVars: { autoplay: 0 } }}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <VoiceRecorder
              targetText={
                manualTargetText ||
                subtitles.find(s => {
                  const start = s.offset / 1000;
                  const end = start + (s.duration / 1000);
                  return currentTime >= start && currentTime < end;
                })?.text || ""
              }
            />
          </div>

          <CommentSection videoId={videoId} />
        </div>

        {/* 右カラム: 字幕リスト */}
        <div className="flex-1 bg-white rounded-lg shadow-lg border p-2 md:p-4 min-h-[300px]">
          <h2 className="text-sm text-gray-500 font-bold mb-2 px-2">Transcript (Tap words)</h2>
          <div className="space-y-2 h-[400px] md:h-[600px] overflow-y-auto">
            {subtitles.length > 0 ? (
              subtitles.map((sub, i) => (
                <div
                  key={i}
                  onClick={() => {
                    handleSeek(sub.offset);
                    setManualTargetText(sub.text);
                  }}
                  className={`cursor-pointer p-3 hover:bg-gray-100 rounded text-base md:text-lg leading-relaxed text-gray-700 transition-colors border-b border-gray-50
                    ${manualTargetText === sub.text ? 'bg-green-50 border-l-4 border-green-500' : ''}
                  `}
                >
                  {(sub.text || '').split(' ').map((word, wIndex) => {
                    const isHard = word.length >= 6;
                    return (
                      <span
                        key={wIndex}
                        onClick={(e) => handleWordClick(word, e)}
                        className={`inline-block mx-0.5 px-0.5 rounded ${isHard ? 'text-blue-600 font-bold' : ''}`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
              ))
            ) : <p className="text-gray-400 text-center mt-10">Loading subtitles...</p>}
          </div>
        </div>
      </div>

      {/* --- プロフィール編集モーダル --- */}
      {isProfileOpen && userId && (
        <ProfileModal
          currentName={username}
          userId={userId}
          onClose={() => setIsProfileOpen(false)}
          onUpdate={(newName) => setUsername(newName)}
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

