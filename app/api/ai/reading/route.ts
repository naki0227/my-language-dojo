import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
    try {
        const { subject, level, category, topic } = await request.json();

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // プロンプト作成
        const prompt = `
      You are a professional writer in ${subject}.
      Write a ${category} (style) about "${topic || 'an interesting topic'}" for ${level} level learners.
      
      Requirements:
      1. Language: Write in ${subject}.
      2. Length: About 500-800 words.
      3. Style: 
         - If 'novel', make it engaging with dialogue.
         - If 'essay', make it logical and informative (like a news article or academic paper).
      4. Output JSON format:
         {
           "title": "Title in ${subject}",
           "content": "Full text content..."
         }
      5. Output ONLY the JSON.
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);

        // DBに保存
        await adminSupabase.from('readings').insert([{
            title: data.title,
            content: data.content,
            subject: subject,
            level: level,
            category: category
        }]);

        return NextResponse.json({ success: true, title: data.title });

    } catch (error: any) {
        console.error('Reading Gen Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}