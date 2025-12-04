'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import { DictionaryData } from '@/types';
import { getApiUrl } from '@/lib/api';

export default function InteractiveText({ content, subject }: { content: string, subject: string }) {
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [dictData, setDictData] = useState<DictionaryData | null>(null);
    const [loading, setLoading] = useState(false);

    const handleWordClick = async (word: string) => {
        // 記号除去
        const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
        if (!clean) return;

        setSelectedWord(clean);
        setLoading(true);
        setDictData(null);

        try {
            // メイン画面と同じAPIを呼ぶ
            const aiRes = await fetch(getApiUrl('/api/ai/analyze'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word: clean, targetLang: subject })
            });
            const data = await aiRes.json();
            setDictData({
                word: clean,
                translation: data.translation,
                meanings: [{ partOfSpeech: data.partOfSpeech, definitions: [{ definition: data.definition }] }]
            });
        } catch {
            setDictData({ word: clean, translation: "エラー", sourceLang: subject });
        } finally {
            setLoading(false);
        }
    };

    // 単語保存
    const handleSave = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !dictData) return;

        await supabase.from('vocab').insert([{
            user_id: session.user.id,
            word: dictData.word,
            translation: dictData.translation || '',
            subject: subject
        }]);
        alert('保存しました！');
        setSelectedWord(null);
    };

    // Markdownのレンダラーをカスタマイズして、テキストを単語単位でラップする
    // ※ 簡易実装: pタグの中身などをスペースで分割してspanにする
    // 厳密なMarkdown解析と単語分割の共存は難しいため、
    // 今回は「選択モード」のようなUIにするか、主要なテキスト部分だけを対象にします。

    // ★簡易版: テキストを選択（ハイライト）して辞書を引くスタイルではなく、
    // 「分からない単語入力欄」をページ下部に設けるか、
    // 今回は「教科書ビューワー」側で実装します。

    return (
        <>
            <div className="prose max-w-none text-gray-800 leading-relaxed">
                {/* 通常のMarkdown表示。クリック機能は別途実装が必要 */}
                <ReactMarkdown>{content}</ReactMarkdown>
            </div>

            {/* 辞書ツールチップ (固定ボタンから呼び出しなど) */}
            {/* 今回は複雑になるため、教科書ページ側での実装（ステップ4）で対応します */}
        </>
    );
}

