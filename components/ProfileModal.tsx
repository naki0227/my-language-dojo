// components/ProfileModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
    currentName: string;
    userId: string;
    onClose: () => void;
    onUpdate: (newName: string) => void; // 更新後に親コンポーネントに知らせる
};

export default function ProfileModal({ currentName, userId, onClose, onUpdate }: Props) {
    const [newName, setNewName] = useState(currentName);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !userId) return;

        setIsUpdating(true);

        // 1. profilesテーブルを更新
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ username: newName })
            .eq('id', userId);

        if (profileError) {
            alert('更新エラー: ' + profileError.message);
            setIsUpdating(false);
            return;
        }

        // 2. 過去のコメントの名前も一括更新する場合（オプション）
        // 今回はシンプルにプロフィールだけ更新します。
        // コメントテーブルのusernameは「投稿時の名前」として残る仕様が一般的ですが、
        // もし変えたい場合は別途SQLで一括置換が必要です。

        alert('名前を変更しました！');
        onUpdate(newName); // 親（メイン画面）の表示を更新
        onClose();         // 閉じる
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-blue-600 p-4">
                    <h2 className="text-white text-lg font-bold flex items-center gap-2">
                        ✏️ プロフィール編集
                    </h2>
                </div>

                <form onSubmit={handleSave} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">ユーザー名</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-black"
                            placeholder="新しい名前を入力"
                            maxLength={20}
                            autoFocus
                        />
                        <p className="text-xs text-gray-400 mt-2">※ 20文字以内で入力してください</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={isUpdating || !newName.trim()}
                            className="flex-1 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition"
                        >
                            {isUpdating ? '更新中...' : '保存する'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
