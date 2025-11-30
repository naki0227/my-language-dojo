import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use Service Role Key if available to bypass RLS, otherwise fallback to Anon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const adminSupabase = createClient(supabaseUrl, supabaseKey);

import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Increased to 120s

export async function POST(request: Request) {
    try {
        await verifyAdmin(request);
        const body = await request.json();
        const { subject, level, type } = body;

        console.log(`[API] Generating ${type} for ${subject} (${level})...`);

        if (!process.env.GOOGLE_GEMINI_KEY) {
            throw new Error('GOOGLE_GEMINI_KEY is not set');
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY);

        // Helper to handle model fallback
        const generateWithFallback = async (prompt: string) => {
            try {
                // Primary: gemini-2.5-flash
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                return await model.generateContent(prompt);
            } catch (error: any) {
                if (error.message.includes('429')) {
                    console.warn('Rate limit hit for gemini-2.5-flash, switching to gemini-2.5-pro');
                    // Fallback: gemini-2.5-pro
                    const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
                    return await fallbackModel.generateContent(prompt);
                }
                throw error;
            }
        };

        let existingTitles: string[] = [];
        let tableName = type === 'textbook' ? 'textbooks' : (type === 'wordbook' ? 'wordbooks' : 'exercises');

        // Only fetch existing titles if table is correct (skip for podcast if it uses textbooks table but logic differs)
        try {
            const { data } = await adminSupabase.from(tableName).select('title').eq('subject', subject).ilike('title', `%${level}%`);
            if (data) existingTitles = data.map(d => d.title);
        } catch (e) {
            console.warn('Failed to fetch existing titles, proceeding without them:', e);
        }

        // --- 教科書 ---
        if (type === 'textbook') {
            const prompt = `
            Create a NEW textbook lesson for ${subject} (Level ${level}).
            Existing: ${existingTitles.slice(-20).join(', ')}
            Output JSON: { "title": "【${level}】 Topic", "content": "Markdown (Japanese)" }
        `;
            const res = await generateWithFallback(prompt);
            const text = res.response.text().replace(/```json|```/g, '').trim();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error (Textbook):', text);
                throw new Error('Invalid JSON from AI');
            }

            const { error } = await adminSupabase.from('textbooks').insert([{ title: data.title, content: data.content, subject, level }]);
            if (error) throw error;
            return NextResponse.json({ success: true, title: data.title });
        }

        // --- Podcast (Dialogue) ---
        if (type === 'podcast') {
            const prompt = `
            Create a NEW podcast dialogue script for ${subject} learners (Level ${level}).
            Topic: Interesting cultural topic or daily life situation.
            Format: A dialogue between two hosts (Host A and Host B).
            
            Instructions:
            1. The dialogue should be in ${subject}.
            2. Add a Japanese translation for difficult phrases in parentheses or as a separate section.
            3. Keep it engaging and suitable for listening practice.
            4. **LENGTH**: Make it LONG and detailed (at least 1000 words). Cover the topic in depth.
            
            Output JSON: { "title": "【Podcast】 Topic", "content": "Script content..." }
            `;
            const res = await generateWithFallback(prompt);
            const text = res.response.text().replace(/```json|```/g, '').trim();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error (Podcast):', text);
                throw new Error('Invalid JSON from AI');
            }

            // Save as textbook with category 'podcast' (assuming category column exists, otherwise just title distinction)
            // Note: The insert below assumes 'category' column might not exist or is optional. 
            // If it exists, we should use it. Based on admin page, it seems likely.
            // Let's try to insert with category if possible, but standard insert here doesn't show it.
            // We'll stick to the pattern but add [Podcast] to title.
            const { error } = await adminSupabase.from('textbooks').insert([{ title: data.title, content: data.content, subject, level }]);
            if (error) throw error;
            return NextResponse.json({ success: true, title: data.title });
        }

        // --- 単語帳 ---
        if (type === 'wordbook') {
            const prompt = `
            Create a NEW vocab list for ${subject} (Level ${level}).
            Existing: ${existingTitles.slice(-20).join(', ')}
            
            Instructions:
            1. "meaning" MUST be in Japanese.
            2. "example" should be a sentence in ${subject}.
            3. "description" should be in Japanese.
            
            Output JSON: { "title": "Title", "description": "Japanese Description", "words": [{"word": "...", "meaning": "Japanese meaning", "example": "..."}] }
        `;
            const res = await generateWithFallback(prompt);
            const text = res.response.text().replace(/```json|```/g, '').trim();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error (Wordbook):', text);
                throw new Error('Invalid JSON from AI');
            }

            const { data: nb, error: nbError } = await adminSupabase.from('wordbooks').insert([{ title: data.title, level, subject, description: data.description }]).select('id').single();
            if (nbError) throw nbError;

            if (nb) {
                const { error: wError } = await adminSupabase.from('wordbook_entries').insert(data.words.map((w: any) => ({ ...w, wordbook_id: nb.id, subject })));
                if (wError) console.error('Wordbook Entries Insert Error:', wError);
            }
            return NextResponse.json({ success: true, title: data.title });
        }

        // --- ドリル ---
        if (type === 'drill') {
            const prompt = `
            Create a NEW quiz for ${subject} (Level ${level}).
            
            Instructions:
            1. "explanation" MUST be in Japanese.
            2. Questions should be suitable for ${level} level.
            
            Output JSON: { "title": "Title", "category": "grammar", "questions": [{"question": "...", "options": ["A","B","C","D"], "answer_index": 0, "explanation": "Japanese explanation"}] }
        `;
            const res = await generateWithFallback(prompt);
            const text = res.response.text().replace(/```json|```/g, '').trim();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error (Drill):', text);
                throw new Error('Invalid JSON from AI');
            }

            // Validate data structure
            if (!data.title || !data.questions || !Array.isArray(data.questions)) {
                throw new Error('Invalid data structure from AI');
            }

            const { data: ne, error: neError } = await adminSupabase.from('exercises').insert([{ title: data.title, level, subject, category: data.category || 'general' }]).select('id').single();

            if (neError) {
                console.error('Exercise Insert Error:', neError);
                throw new Error('Failed to create exercise: ' + neError.message);
            }

            if (ne) {
                console.log(`[API] Inserting ${data.questions.length} questions for exercise ${ne.id}`);
                // Remove 'level' and 'subject' as they don't exist in exercise_questions
                const { error: qError } = await adminSupabase.from('exercise_questions').insert(data.questions.map((q: any) => ({ ...q, exercise_id: ne.id })));
                if (qError) {
                    console.error('Questions Insert Error:', qError);
                    throw new Error('Failed to save questions: ' + qError.message);
                }
            }
            return NextResponse.json({ success: true, title: data.title });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error: any) {
        console.error('API Error:', error);
        const status = error.message.includes('429') ? 429 : 500;
        return NextResponse.json({ error: error.message, stack: error.stack }, { status });
    }
}