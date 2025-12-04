import { createClient } from '@supabase/supabase-js';
import { config } from './config';

const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.anonKey;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key is missing!', { supabaseUrl, supabaseKey });
} else {
    console.log('Supabase Client Initializing...', { url: supabaseUrl });
}

export const supabase = createClient(supabaseUrl, supabaseKey);
