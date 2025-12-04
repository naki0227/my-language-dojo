'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

import { getApiUrl } from '@/lib/api';

export default function PricingPage() {
    const [isUpgrading, setIsUpgrading] = useState(false);

    const handleUpgrade = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('Please login first!');
            return;
        }

        setIsUpgrading(true);

        try {
            // 1. Create Checkout Session
            const response = await fetch(getApiUrl('/api/checkout'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: session.user.id,
                    // priceId: 'price_xxx', // Optional if handled on server
                }),
            });

            const { sessionId, error } = await response.json();

            if (error) {
                throw new Error(error);
            }

            // 2. Redirect to Stripe Checkout
            const stripe = await stripePromise;
            if (!stripe) throw new Error('Stripe failed to load');

            const { error: stripeError } = await (stripe as any).redirectToCheckout({ sessionId });

            if (stripeError) {
                throw new Error(stripeError.message);
            }
        } catch (err: any) {
            alert('Upgrade failed: ' + err.message);
            setIsUpgrading(false);
        }
    };

    return (
        <main className="min-h-screen p-4 md:p-8 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Decorative blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-40 -left-40 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="relative z-10 w-full max-w-5xl">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-black text-gray-800 mb-4 tracking-tight">Unlock Your Potential 🚀</h1>
                    <p className="text-xl text-gray-600 font-medium">Choose the plan that accelerates your Vidnitive journey.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 w-full">
                    {/* Free Plan */}
                    <div className="glass-card p-8 flex flex-col hover:scale-[1.02] transition-transform duration-300">
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">Free Plan</h2>
                        <p className="text-gray-500 mb-6 font-medium">Start your journey here</p>
                        <div className="text-5xl font-black text-gray-800 mb-8">¥0 <span className="text-lg font-normal text-gray-500">/month</span></div>

                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-center gap-3 text-gray-700 font-medium"><span className="text-green-500 text-xl">✅</span> Unlimited Video & Subtitles</li>
                            <li className="flex items-center gap-3 text-gray-700 font-medium"><span className="text-green-500 text-xl">✅</span> Unlimited Dictionary & Vocab</li>
                            <li className="flex items-center gap-3 text-gray-500"><span className="text-yellow-500 text-xl">⚠️</span> AI Translation & Grading (3/day)</li>
                            <li className="flex items-center gap-3 text-gray-500"><span className="text-yellow-500 text-xl">⚠️</span> Limited Textbook Access</li>
                        </ul>

                        <Link href="/" className="block w-full py-4 rounded-xl font-bold text-center border-2 border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">
                            Continue for Free
                        </Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-1 rounded-3xl shadow-2xl hover:scale-[1.02] transition-transform duration-300 relative">
                        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-black px-4 py-1.5 rounded-bl-2xl rounded-tr-2xl shadow-sm z-10 tracking-wider">RECOMMENDED</div>
                        <div className="bg-white/10 backdrop-blur-md p-8 rounded-[22px] h-full flex flex-col text-white border border-white/20">
                            <h2 className="text-3xl font-bold mb-2 text-white">Pro Plan</h2>
                            <p className="text-blue-100 mb-6 font-medium">Master languages seriously</p>
                            <div className="text-5xl font-black mb-8 text-white">¥500 <span className="text-lg font-normal text-blue-200">/month</span></div>

                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3"><span className="text-yellow-300 text-xl">✨</span> <strong>Unlimited AI Translation & Grading</strong></li>
                                <li className="flex items-center gap-3"><span className="text-yellow-300 text-xl">✨</span> <strong>Full Access to All Textbooks</strong></li>
                                <li className="flex items-center gap-3"><span className="text-yellow-300 text-xl">✨</span> <strong>Ad-free & Priority Support</strong></li>
                                <li className="flex items-center gap-3"><span className="text-yellow-300 text-xl">✨</span> <strong>Exclusive Pro Badge</strong></li>
                            </ul>

                            <button
                                onClick={handleUpgrade}
                                disabled={isUpgrading}
                                className="block w-full py-4 rounded-xl font-bold text-center bg-white text-blue-600 hover:bg-blue-50 shadow-lg transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isUpgrading ? 'Processing...' : 'Upgrade to Pro'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <Link href="/" className="text-gray-500 hover:text-indigo-600 font-bold transition">← Back to Studio</Link>
                </div>
            </div>
        </main>
    );
}

