import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
    try {
        const { subject, level, type } = await request.json();

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        // ★修正: 安定のため Flash モデルを使用
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        let existingTitles: string[] = [];
        let tableName = type === 'textbook' ? 'textbooks' : (type === 'wordbook' ? 'wordbooks' : 'exercises');

        const { data } = await adminSupabase.from(tableName).select('title').eq('subject', subject).ilike('title', `%${level}%`);
        if (data) existingTitles = data.map(d => d.title);

        // --- 教科書 ---
        if (type === 'textbook') {
            const prompt = `
            Create a NEW textbook lesson for ${subject} (Level ${level}).
            Existing: ${existingTitles.slice(-20).join(', ')}
            Output JSON: { "title": "【${level}】 Topic", "content": "Markdown (Japanese)" }
        `;
            const res = await model.generateContent(prompt);
            const data = JSON.parse(res.response.text().replace(/```json|```/g, '').trim());
            await adminSupabase.from('textbooks').insert([{ title: data.title, content: data.content, subject, level }]);
            return NextResponse.json({ success: true, title: data.title });
        }

        // --- 単語帳 ---
        if (type === 'wordbook') {
            const prompt = `
            Create a NEW vocab list for ${subject} (Level ${level}).
            Existing: ${existingTitles.slice(-20).join(', ')}
            Output JSON: { "title": "Title", "description": "Desc", "words": [{"word": "...", "meaning": "...", "example": "..."}] }
        `;
            const res = await model.generateContent(prompt);
            const data = JSON.parse(res.response.text().replace(/```json|```/g, '').trim());
            const { data: nb } = await adminSupabase.from('wordbooks').insert([{ title: data.title, level, subject, description: data.description }]).select('id').single();
            if (nb) await adminSupabase.from('wordbook_entries').insert(data.words.map((w: any) => ({ ...w, wordbook_id: nb.id, subject })));
            return NextResponse.json({ success: true, title: data.title });
        }

        // --- ドリル ---
        if (type === 'drill') {
            const prompt = `
            Create a NEW quiz for ${subject} (Level ${level}).
            Output JSON: { "title": "Title", "category": "grammar", "questions": [{"question": "...", "options": ["A","B","C","D"], "answer_index": 0, "explanation": "..."}] }
        `;
            const res = await model.generateContent(prompt);
            const data = JSON.parse(res.response.text().replace(/```json|```/g, '').trim());
            const { data: ne } = await adminSupabase.from('exercises').insert([{ title: data.title, level, subject, category: data.category }]).select('id').single();
            if (ne) await adminSupabase.from('exercise_questions').insert(data.questions.map((q: any) => ({ ...q, exercise_id: ne.id, subject, level })));
            return NextResponse.json({ success: true, title: data.title });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}