'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// NGワードリスト
const NG_WORDS = ['fuck', 'shit', '死ね', 'バカ', 'アホ', 'stupid'];

type Comment = {
    id: number;
    username: string;
    content: string;
    likes: number;
    created_at: string;
    user_id: string;
};

type Props = {
    videoId?: string;    // 動画の場合
    textbookId?: number; // 教科書の場合
};

export default function CommentSection({ videoId, textbookId }: Props) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) setCurrentUserId(session.user.id);
            fetchComments();
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId, textbookId]);

    const fetchComments = async () => {
        let query = supabase
            .from('comments')
            .select('*')
            .order('created_at', { ascending: false });

        // 動画か教科書かで条件分岐
        if (videoId) {
            query = query.eq('video_id', videoId);
        } else if (textbookId) {
            query = query.eq('textbook_id', textbookId);
        } else {
            return; // どちらも指定がない場合は何もしない
        }

        const { data } = await query;
        if (data) setComments(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        if (!currentUserId) { alert('ログインしてください'); return; }

        const hasNgWord = NG_WORDS.some(word => newComment.toLowerCase().includes(word));
        if (hasNgWord) {
            alert('不適切な言葉が含まれています。修正してください。');
            return;
        }

        setIsSubmitting(true);
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', currentUserId).single();
        const username = profile?.username || 'Guest';

        // 保存データを準備
        const insertData: any = {
            user_id: currentUserId,
            username,
            content: newComment,
        };
        if (videoId) insertData.video_id = videoId;
        if (textbookId) insertData.textbook_id = textbookId;

        const { error } = await supabase.from('comments').insert([insertData]);

        if (!error) {
            setNewComment('');
            fetchComments();
        } else {
            alert('送信エラー: ' + error.message);
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('削除しますか？')) return;
        await supabase.from('comments').delete().eq('id', id);
        setComments(comments.filter(c => c.id !== id));
    };

    const handleLike = async (id: number, currentLikes: number) => {
        setComments(comments.map(c => c.id === id ? { ...c, likes: currentLikes + 1 } : c));
        await supabase.from('comments').update({ likes: currentLikes + 1 }).eq('id', id);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mt-8 w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                💬 コメント・質問 <span className="text-sm bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">{comments.length}</span>
            </h3>

            <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={currentUserId ? "質問やメモを書き込もう..." : "ログインしてコメント"}
                    disabled={!currentUserId}
                    className="flex-1 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
                <button type="submit" disabled={isSubmitting || !newComment || !currentUserId} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300">送信</button>
            </form>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {comments.length === 0 && <p className="text-center text-sm text-gray-400">No comments yet.</p>}
                {comments.map((comment) => (
                    <div key={comment.id} className="border-b border-gray-100 pb-3 last:border-0">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">{comment.username.charAt(0)}</div>
                                <span className="font-bold text-gray-700 text-sm">{comment.username}</span>
                                <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                            </div>
                            {currentUserId === comment.user_id && (
                                <button onClick={() => handleDelete(comment.id)} className="text-xs text-gray-400 hover:text-red-500">削除</button>
                            )}
                        </div>
                        <p className="text-gray-800 text-sm ml-8">{comment.content}</p>
                        <div className="flex items-center gap-4 ml-8 mt-2">
                            <button onClick={() => handleLike(comment.id, comment.likes)} className="text-gray-400 hover:text-red-500 text-xs flex items-center gap-1 group">
                                <span className="group-hover:scale-125 transition-transform">❤️</span> {comment.likes}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}


