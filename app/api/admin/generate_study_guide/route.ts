import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
    try {
        const { videoId, transcript, subject } = await request.json();

        if (!videoId || !transcript) {
            return NextResponse.json({ error: 'Missing videoId or transcript' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
        You are a language teacher creating a study guide for a video.
        Target Language: ${subject || 'English'}
        
        Analyze the following transcript and create a comprehensive study guide.
        
        Transcript:
        ${transcript.substring(0, 30000)}... (truncated if too long)
        
        Output JSON format:
        {
            "title": "A catchy title for this lesson",
            "summary": "A 3-sentence summary of the video content in Japanese.",
            "key_sentences": [
                { "sentence": "Original sentence", "translation": "Japanese translation", "explanation": "Why this is important" }
            ],
            "vocabulary": [
                { "word": "Word", "meaning": "Japanese meaning", "context": "Example usage from video or similar" }
            ],
            "grammar": [
                { "point": "Grammar point", "explanation": "Explanation in Japanese" }
            ],
            "quiz": [
                { "question": "Question about the video content (in Target Language)", "options": ["A", "B", "C", "D"], "answer": "Correct Option (e.g. A)" }
            ]
        }
        
        Requirements:
        1. "key_sentences": Pick 3-5 most useful sentences. The "sentence" MUST be in the Target Language (e.g. English). The "explanation" MUST be in Japanese and explain the grammar/nuance.
        2. "vocabulary": Pick 5-10 difficult/useful words.
        3. "grammar": Pick 2-3 grammar points used in the video.
        4. "quiz": Create 3 comprehension questions.
        5. Output ONLY the JSON.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);

        // Save to DB
        const { error } = await adminSupabase.from('video_study_guides').upsert([{
            video_id: videoId,
            title: data.title,
            summary: data.summary,
            key_sentences: data.key_sentences,
            vocabulary: data.vocabulary,
            grammar: data.grammar,
            quiz: data.quiz
        }], { onConflict: 'video_id' });

        if (error) throw error;

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('Study Guide Gen Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
