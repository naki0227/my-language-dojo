'use client';

import { X, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';

interface LoginRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
    message?: string;
}

export default function LoginRequiredModal({ isOpen, onClose, message = "この機能を使用するにはログインが必要です" }: LoginRequiredModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LogIn className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        ログインが必要です
                    </h3>

                    <p className="text-gray-600 dark:text-gray-300 mb-8">
                        {message}
                    </p>

                    <div className="space-y-3">
                        <Link
                            href="/auth"
                            className="block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <LogIn size={20} />
                            ログイン / 新規登録
                        </Link>

                        <button
                            onClick={onClose}
                            className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
