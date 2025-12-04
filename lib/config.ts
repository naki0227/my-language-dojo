export const config = {
    supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    google: {
        geminiKey: process.env.GOOGLE_GEMINI_KEY!,
    },
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
};

// Simple validation
if (!config.supabase.url || !config.supabase.anonKey) {
    console.warn('Supabase credentials are missing in environment variables.');
}
