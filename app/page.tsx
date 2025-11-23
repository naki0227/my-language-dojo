'use client';

import { useState, useEffect, Suspense } from 'react';
import YouTube, { YouTubePlayer } from 'react-youtube';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import VoiceRecorder from '@/components/VoiceRecorder';
import UserStatus from '@/components/UserStatus'; // ← 新しく作った部品

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
  id: number;
  level: number;
  xp: number;
  next_level_xp: number;
};

// コンテンツ部分 (Suspense対応)
function HomeContent() {
  // --- State管理 ---
  const searchParams = useSearchParams();
  const initialVideoId = searchParams.get('videoId') || 'arj7oStGLkU';

  const [videoId, setVideoId] = useState(initialVideoId);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // 辞書・保存機能用
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [dictData, setDictData] = useState<DictionaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ライブラリ登録用
  const [isRegistering, setIsRegistering] = useState(false);

  // シャドーイング練習用テキスト
  const [manualTargetText, setManualTargetText] = useState<string | null>(null);

  // ユーザー情報 (XP/レベル)
  const [userProfile, setUserProfile] = useState<UserProfile>({ id: 0, level: 1, xp: 0, next_level_xp: 100 });

  // --- XP加算システム (RPGエンジン) ---
  const fetchProfile = async () => {
    // ユーザー情報を取得 (とりあえず最初の1件を取得する簡易実装)
    const { data } = await supabase.from('profiles').select('*').single();
    if (data) {
      setUserProfile(data);
    } else {
      // プロフィールがない場合は作成(エラー回避)
      await supabase.from('profiles').insert([{ username: 'Hero', level: 1, xp: 0, next_level_xp: 100 }]);
      fetchProfile();
    }
  };

  const addXp = async (amount: number) => {
    // 最新の状態を取得してから計算
    const { data: current } = await supabase.from('profiles').select('*').single();
    if (!current) return;

    let newXp = current.xp + amount;
    let newLevel = current.level;
    let newNextXp = current.next_level_xp;
    let leveledUp = false;

    // レベルアップ判定
    if (newXp >= newNextXp) {
      newXp = newXp - newNextXp; // 余ったXPを持ち越し
      newLevel += 1;
      newNextXp = Math.floor(newNextXp * 1.2); // 次のレベルは1.2倍必要
      leveledUp = true;
    }

    // DB更新
    await supabase.from('profiles').update({
      level: newLevel,
      xp: newXp,
      next_level_xp: newNextXp
    }).eq('id', current.id);

    // 画面更新
    setUserProfile({ ...current, level: newLevel, xp: newXp, next_level_xp: newNextXp });

    if (leveledUp) {
      // 簡易的なファンファーレ
      alert(`🎉 LEVEL UP! You reached Lv.${newLevel}!`);
    }
  };

  // --- 初期化処理 ---
  useEffect(() => {
    fetchProfile();
    if (initialVideoId) {
      loadVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 動画読み込み処理 ---
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

  // --- ライブラリ登録機能 ---
  const handleSaveToLibrary = async () => {
    if (subtitles.length === 0) return;
    const confirmSave = confirm('この動画と字幕データをライブラリ（検索用DB）に登録しますか？');
    if (!confirmSave) return;

    setIsRegistering(true);

    try {
      const { error: videoError } = await supabase
        .from('library_videos')
        .upsert([
          {
            video_id: videoId,
            title: `Video ${videoId}`,
            thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          }
        ]);

      if (videoError) throw videoError;

      const subtitleRows = subtitles.map(s => ({
        video_id: videoId,
        text: s.text,
        start_time: s.offset / 1000,
        duration: s.duration / 1000
      }));

      const { error: subError } = await supabase.from('library_subtitles').insert(subtitleRows);
      if (subError) throw subError;

      // ★ここでXP加算★
      await addXp(100);
      alert('ライブラリに登録しました！ (+100 XP)');

    } catch (e) {
      console.error(e);
      alert('登録失敗: ' + e);
    } finally {
      setIsRegistering(false);
    }
  };

  // --- 単語クリック処理 ---
  const handleWordClick = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
    setSelectedWord(cleanWord);
    setDictData(null);
    setIsLoading(true);

    try {
      const dictPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
      const transPromise = fetch(`https://api.mymemory.translated.net/get?q=${cleanWord}&langpair=en|ja`);
      const [dictRes, transRes] = await Promise.all([dictPromise, transPromise]);

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

  // --- Supabaseへの単語保存 ---
  const handleSaveWord = async () => {
    if (!dictData || !selectedWord) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('vocab').insert([{ word: dictData.word, translation: dictData.translation || '翻訳なし' }]);
      if (error) throw error;

      // ★ここでXP加算★
      await addXp(10);
      alert(`「${dictData.word}」を保存しました！ (+10 XP)`);

    } catch (e) {
      console.error(e);
      alert('保存失敗: ' + e);
    } finally {
      setIsSaving(false);
    }
  };

  // --- プレイヤー制御 ---
  const onReady = (event: { target: YouTubePlayer }) => {
    setPlayer(event.target);
    const startParam = searchParams.get('start');
    if (startParam) {
      const startSeconds = parseInt(startParam);
      event.target.seekTo(startSeconds, true);
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

  return (
    <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      {/* ヘッダーエリア */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">My Language Dojo</h1>

        {/* ▼▼▼ ステータス表示 (ここに追加) ▼▼▼ */}
        <div className="mr-auto ml-8">
          <UserStatus
            level={userProfile.level}
            xp={userProfile.xp}
            nextLevelXp={userProfile.next_level_xp}
          />
        </div>
        {/* ▲▲▲ 追加ここまで ▲▲▲ */}

        <div className="flex gap-2">
          <Link href="/search" className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-blue-600 transition flex items-center gap-2">
            🔍 検索
          </Link>
          <Link href="/vocab" className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-700 transition flex items-center gap-2">
            📚 My 単語帳
          </Link>
        </div>
      </div>

      {/* 辞書ポップアップ */}
      {selectedWord && (
        <div className="fixed top-20 right-10 w-80 bg-white p-6 rounded-xl shadow-2xl border border-blue-200 z-50 animate-fade-in text-black">
          <div className="flex justify-between items-start mb-4 border-b pb-2">
            <div>
              <h3 className="text-3xl font-bold text-blue-800 capitalize">{selectedWord}</h3>
              {dictData?.phonetic && <span className="text-gray-500 font-mono text-sm">{dictData.phonetic}</span>}
            </div>
            <button onClick={() => setSelectedWord(null)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">×</button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-4"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
          ) : dictData ? (
            <div className="space-y-4">
              {dictData.translation && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-xs text-gray-500 font-bold mb-1">日本語訳</p>
                  <p className="text-xl font-bold text-gray-800">{dictData.translation}</p>
                </div>
              )}
              {dictData.audio && (
                <button onClick={playAudio} className="w-full flex justify-center items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-bold transition">🔊 発音を聞く</button>
              )}
              {dictData.meanings.length > 0 && (
                <div className="max-h-40 overflow-y-auto pr-2">
                  <p className="text-xs text-gray-400 font-bold mb-1 border-b">ENGLISH DEFINITION</p>
                  {dictData.meanings.map((m, i) => (
                    <div key={i} className="mb-2 mt-2">
                      <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-2">{m.partOfSpeech}</span>
                      <ul className="list-disc pl-4 text-sm text-gray-600 mt-1">{m.definitions.slice(0, 1).map((d, j) => <li key={j}>{d.definition}</li>)}</ul>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleSaveWord} disabled={isSaving} className={`w-full text-white py-3 rounded-lg font-bold shadow-lg transform transition ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:-translate-y-0.5'}`}>
                {isSaving ? '保存中...' : '＋ 単語帳に追加 (+10 XP)'}
              </button>
            </div>
          ) : <p className="text-red-400">データなし</p>}
        </div>
      )}

      {/* 動画ID入力エリア */}
      <div className="w-full max-w-6xl mb-6 flex gap-2">
        <input
          type="text"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          className="border p-2 rounded flex-1 text-black"
          placeholder="YouTube Video ID"
        />
        <button onClick={loadVideo} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-bold">
          Start Lesson
        </button>
        <button
          onClick={handleSaveToLibrary}
          disabled={isRegistering || subtitles.length === 0}
          className={`ml-2 px-4 py-2 rounded font-bold text-white transition whitespace-nowrap
            ${isRegistering || subtitles.length === 0 ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}
          `}
        >
          {isRegistering ? '登録中...' : '💾 ライブラリに追加 (+100 XP)'}
        </button>
      </div>

      {/* メインエリア */}
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl">
        <div className="flex-1 flex flex-col gap-6">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
            <YouTube videoId={videoId} onReady={onReady} opts={{ width: '100%', height: '100%', playerVars: { autoplay: 0 } }} className="absolute top-0 left-0 w-full h-full" />
          </div>

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

        <div className="flex-1 h-[500px] overflow-y-auto bg-white rounded-lg shadow-lg border p-4">
          <div className="space-y-4">
            {subtitles.length > 0 ? (
              subtitles.map((sub, i) => (
                <div
                  key={i}
                  onClick={() => {
                    handleSeek(sub.offset);
                    setManualTargetText(sub.text);
                  }}
                  className={`cursor-pointer p-2 hover:bg-gray-100 rounded text-lg leading-relaxed text-gray-700 transition-colors
                    ${manualTargetText === sub.text ? 'bg-green-100 border-l-4 border-green-500' : ''}
                  `}
                >
                  {(sub.text || '').split(' ').map((word, wIndex) => {
                    const isHard = word.length >= 6;
                    return (
                      <span key={wIndex} onClick={(e) => handleWordClick(word, e)} className={`inline-block mx-1 px-1 rounded transition-colors ${isHard ? 'text-blue-600 font-bold hover:bg-blue-100 cursor-pointer' : 'hover:bg-gray-200 cursor-pointer'}`}>
                        {word}
                      </span>
                    );
                  })}
                </div>
              ))
            ) : <p className="text-gray-400 text-center mt-10">Start Lessonボタンを押してください...</p>}
          </div>
        </div>
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
