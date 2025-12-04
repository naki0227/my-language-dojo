import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-11-17.clover',
});

export async function POST(req: Request) {
    try {
        // 1. Get the user from the request (optional, but good for security/metadata)
        // Note: In a real app, you'd verify the session token here.
        // For simplicity, we'll trust the client sends the user ID or use metadata.
        // Better: Get session from supabase auth helper if available on server.

        // Let's assume we pass userId in the body for now, or rely on client_reference_id
        const { userId, priceId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 2. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    // For testing, you can use a hardcoded price ID or create one on the fly
                    // price: priceId, 
                    price_data: {
                        currency: 'jpy',
                        product_data: {
                            name: 'Vidnitive Pro Plan',
                            description: 'Unlimited AI Translation, Grading, and more!',
                        },
                        unit_amount: 500, // 500 JPY
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${req.headers.get('origin')}/dashboard?payment=success`,
            cancel_url: `${req.headers.get('origin')}/pricing?payment=cancelled`,
            client_reference_id: userId, // Crucial for identifying the user in the webhook
            metadata: {
                userId: userId,
            },
        });

        return NextResponse.json({ sessionId: session.id });
    } catch (err: any) {
        console.error('Stripe Checkout Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
