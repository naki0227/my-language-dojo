'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Comment = {
    id: number;
    username: string;
    content: string;
    likes: number;
    created_at: string;
};

type Props = {
    videoId: string;
};

export default function CommentSection({ videoId }: Props) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // 動画IDが変わったらコメントを読み込む & ログインユーザー確認
    useEffect(() => {
        const init = async () => {
            // ログインユーザーIDを取得
            const { data: { session } } = await supabase.auth.getSession();
            if (session) setUserId(session.user.id);

            fetchComments();
        };
        init();
    }, [videoId]);

    const fetchComments = async () => {
        const { data } = await supabase
            .from('comments')
            .select('*')
            .eq('video_id', videoId)
            .order('created_at', { ascending: false });

        if (data) setComments(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        if (!userId) {
            alert('コメントするにはログインが必要です');
            return;
        }

        setIsSubmitting(true);

        // プロフィールから名前を取得
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();

        const username = profile?.username || '名無しさん';

        // ★修正ポイント: user_id を含めて保存する
        const { error } = await supabase
            .from('comments')
            .insert([{
                video_id: videoId,
                user_id: userId, // ← これが必要でした！
                username,
                content: newComment
            }]);

        if (!error) {
            setNewComment('');
            fetchComments(); // リスト更新
        } else {
            console.error(error);
            alert('送信エラー: ' + error.message);
        }
        setIsSubmitting(false);
    };

    const handleLike = async (id: number, currentLikes: number) => {
        // 楽観的UI更新
        setComments(comments.map(c => c.id === id ? { ...c, likes: currentLikes + 1 } : c));

        await supabase
            .from('comments')
            .update({ likes: currentLikes + 1 })
            .eq('id', id);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mt-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                💬 みんなのコメント <span className="text-sm bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">{comments.length}</span>
            </h3>

            {/* 入力フォーム */}
            <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={userId ? "感想やメモを残そう..." : "ログインしてコメントを書こう"}
                    disabled={!userId}
                    className="flex-1 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-black disabled:bg-gray-100"
                />
                <button
                    type="submit"
                    disabled={isSubmitting || !newComment || !userId}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition"
                >
                    送信
                </button>
            </form>

            {/* コメント一覧 */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {comments.length === 0 ? (
                    <p className="text-gray-400 text-center text-sm py-4">まだコメントはありません。</p>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="border-b border-gray-100 pb-3 last:border-0 animate-fade-in">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {comment.username.charAt(0)}
                                    </div>
                                    <span className="font-bold text-gray-700 text-sm">{comment.username}</span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <p className="text-gray-800 text-sm leading-relaxed ml-8">{comment.content}</p>

                            <div className="flex items-center gap-4 ml-8 mt-2">
                                <button
                                    onClick={() => handleLike(comment.id, comment.likes)}
                                    className="text-gray-400 hover:text-red-500 text-xs flex items-center gap-1 transition group"
                                >
                                    <span className="group-hover:scale-125 transition-transform">❤️</span> {comment.likes}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
