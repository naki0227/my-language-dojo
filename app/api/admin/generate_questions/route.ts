import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
    try {
        await verifyAdmin(request);
        const { subject, level, count } = await request.json();

        if (!subject || !level || !count) {
            return NextResponse.json({ error: 'Subject, level, and count are required' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Generate questions in a batch
        // Cap at 20 per request to ensure JSON stability, though the UI might loop for more
        const effectiveCount = Math.min(count, 20);

        const prompt = `
      Generate ${effectiveCount} multiple-choice questions for ${subject} learners at ${level} level.
      The questions must cover grammar, vocabulary, and reading comprehension appropriate for this level.
      
      Output Format (JSON Array):
      [
        {"question": "Question text in ${subject} (or English if appropriate for instruction)", "options": ["A", "B", "C", "D"], "answer_index": 0, "category": "grammar/vocabulary/reading", "level": "${level}"}
      ]
      Output ONLY the JSON array.
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();

        let questionData;
        try {
            questionData = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error", text);
            throw new Error("Failed to parse AI response as JSON");
        }

        if (!Array.isArray(questionData)) {
            throw new Error("AI did not return an array");
        }

        // DBに問題を登録
        const questionRows = questionData.map((q: any) => ({
            subject: subject,
            category: q.category || 'general',
            question: q.question,
            options: q.options,
            answer_index: q.answer_index,
            level: q.level || level
        }));

        const { error } = await adminSupabase.from('proficiency_questions').insert(questionRows);

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            count: questionRows.length,
            message: `Generated ${questionRows.length} questions for ${subject} (${level})`
        });

    } catch (error: any) {
        console.error('Question Gen Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
