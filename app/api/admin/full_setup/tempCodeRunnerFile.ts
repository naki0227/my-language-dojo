import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
    try {
        const { subject } = await request.json();

        if (!subject) {
            return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        console.log(`[SETUP] Starting full setup for: ${subject}`);

        // --- STEP 1: 単語帳 (100語) 生成 ---
        const wordbookPrompt = `
      You are generating content for a ${subject} learning app.
      Generate 100 essential, beginner-level words and phrases for ${subject} learners.
      
      Output Format (JSON Array):
      [
        {"word": "Word/Phrase in ${subject}", "meaning": "Japanese Meaning", "example": "Simple example sentence in ${subject}"}
      ]
      Output ONLY the JSON array.
    `;
        const wordbookResult = await model.generateContent(wordbookPrompt);
        const wordbookData = JSON.parse(wordbookResult.response.text().replace(/```json|```/g, '').trim());

        // DBに単語帳を登録
        const { data: newBook } = await adminSupabase
            .from('wordbooks')
            .insert([{ title: `${subject} Basic Vocabulary 100`, level: 'A1-A2', subject: subject, description: 'AI generated 100 basic words' }])
            .select('id')
            .single();

        const wordbookRows = wordbookData.map((w: any) => ({
            wordbook_id: newBook!.id,
            word: w.word,
            meaning: w.meaning,
            example: w.example,
            subject: subject
        }));
        await adminSupabase.from('wordbook_entries').insert(wordbookRows);

        console.log(`[SETUP] Added ${wordbookRows.length} words.`);


        // --- STEP 2: テスト問題 (20問) 生成 ---
        const questionPrompt = `
      Generate 20 multiple-choice questions for ${subject} beginners (A1-A2 level).
      The questions must cover basic grammar, vocabulary, and simple concepts of ${subject}.
      
      Output Format (JSON Array):
      [
        {"question": "Question text in Japanese or English.", "options": ["A", "B", "C", "D"], "answer_index": 0, "category": "grammar", "level": "A1"}
      ]
      Output ONLY the JSON array.
    `;
        const questionResult = await model.generateContent(questionPrompt);
        const questionData = JSON.parse(questionResult.response.text().replace(/```json|```/g, '').trim());

        // DBに問題を登録
        const questionRows = questionData.map((q: any) => ({
            subject: subject,
            category: q.category || 'grammar',
            question: q.question,
            options: q.options,
            answer_index: q.answer_index,
            level: q.level || 'A1'
        }));
        await adminSupabase.from('proficiency_questions').insert(questionRows);

        console.log(`[SETUP] Added ${questionRows.length} questions.`);


        // --- STEP 3: 教科書 (3冊) 生成 ---
        const textbookTopics = [
            `Basic Greetings and Pronunciation in ${subject}`,
            `Essential Grammar Rules in ${subject}`,
            `Simple Conversation Starters in ${subject}`
        ];
        let textbookCount = 0;

        for (const topic of textbookTopics) {
            const contentPrompt = `
            You are writing a beginner textbook for ${subject}.
            Write a detailed Markdown lesson about "${topic}". The language must be Japanese for explanation.
            
            Requirements:
            1. Title must be Level 1 Header (# ).
            2. Explain clearly in Japanese.
            3. Include a relevant YouTube video example using the placeholder: [[video:VIDEO_ID:START_SECONDS:TITLE]].
            Output ONLY the Markdown content.
        `;
            const contentResult = await model.generateContent(contentPrompt);
            const content = contentResult.response.text().replace(/```markdown|```/g, '').trim();

            await adminSupabase.from('textbooks').insert([{
                title: `入門編 Vol.${textbookCount + 1}: ${topic}`,
                content: content,
                subject: subject
            }]);
            textbookCount++;
        }

        console.log(`[SETUP] Added ${textbookCount} textbooks.`);


        return NextResponse.json({
            success: true,
            textbooks: textbookCount,
            words: wordbookRows.length,
            questions: questionRows.length,
            message: `Full setup for ${subject} complete!`
        });

    } catch (error: any) {
        console.error('[SETUP] Fatal Error:', error);
        return NextResponse.json({ error: error.message || 'Unknown setup error' }, { status: 500 });
    }
}

