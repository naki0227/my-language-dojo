import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { YoutubeTranscript } from 'youtube-transcript';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
    try {
        console.log('[API] Study Guide Generate Request Received');
        const body = await request.json();
        console.log('[API] Request Body:', body);
        const { videoId, subject, explanationLang } = body;

        if (!videoId) {
            return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
        }

        const targetExplanationLang = explanationLang || 'Japanese';

        // 1. Check if already exists (Double check)
        const { data: existing } = await adminSupabase
            .from('video_study_guides')
            .select('*')
            .match({ video_id: videoId, explanation_lang: targetExplanationLang }) // Check specific lang
            .single();

        if (existing) {
            return NextResponse.json({ success: true, data: existing });
        }

        // 2. Fetch Transcript
        let transcriptText = "";
        try {
            // Plan A: youtube-transcript
            console.log('[API] Trying Plan A: youtube-transcript');
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            if (!transcript || transcript.length === 0) {
                throw new Error('Plan A returned empty transcript');
            }
            transcriptText = transcript.map((t: any) => t.text).join(' ');
            if (!transcriptText.trim()) {
                throw new Error('Plan A returned empty text');
            }
            console.log('[API] Plan A Success. Length:', transcriptText.length);
        } catch (errA) {
            console.warn('[API] Plan A failed:', errA);
            try {
                // Plan B: youtubei.js
                console.log('[API] Trying Plan B: youtubei.js');
                const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
                const info = await youtube.getInfo(videoId);
                const transcriptData = await info.getTranscript();
                if (transcriptData?.transcript?.content?.body?.initial_segments) {
                    // @ts-ignore
                    transcriptText = transcriptData.transcript.content.body.initial_segments
                        .map((segment: any) => segment.snippet.text)
                        .join(' ');
                    console.log('[API] Plan B Success. Length:', transcriptText.length);
                } else {
                    console.warn('[API] Plan B found no segments');
                }
            } catch (errB) {
                console.error('[API] Failed to fetch transcript:', errB);
                // Don't return here, let it fall through to the check below
            }
        }

        if (!transcriptText) {
            console.error('[API] No transcript found after all attempts.');
            return NextResponse.json({ error: 'No transcript found.' }, { status: 404 });
        }

        // 3. Generate Study Guide
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
        You are a language teacher creating a study guide for a video.
        Target Language (Video Language): ${subject || 'English'}
        Explanation Language: ${targetExplanationLang}
        
        Analyze the following transcript and create a comprehensive study guide.
        
        Transcript:
        ${transcriptText.substring(0, 30000)}... (truncated if too long)
        
        Output JSON format:
        {
            "title": "A catchy title for this lesson",
            "summary": "A 3-sentence summary of the video content in ${targetExplanationLang}.",
            "key_sentences": [
                { "sentence": "Original sentence in Target Language", "translation": "Translation in ${targetExplanationLang}", "explanation": "Explanation in ${targetExplanationLang}" }
            ],
            "vocabulary": [
                { "word": "Word in Target Language", "meaning": "Meaning in ${targetExplanationLang}", "context": "Example usage" }
            ],
            "grammar": [
                { "point": "Grammar point", "explanation": "Explanation in ${targetExplanationLang}" }
            ],
            "quiz": [
                { "question": "Question about the video content (in Target Language)", "options": ["A", "B", "C", "D"], "answer": "Correct Option (e.g. A)" }
            ]
        }
        
        Requirements:
        1. "key_sentences": Pick 3-5 most useful sentences. The "sentence" MUST be in the Target Language. The "explanation" MUST be in ${targetExplanationLang}.
        2. "vocabulary": Pick 5-10 difficult/useful words.
        3. "grammar": Pick 2-3 grammar points used in the video.
        4. "quiz": Create 3 comprehension questions.
        5. Output ONLY the JSON.
        `;

        const result = await model.generateContent(prompt);
        console.log('[API] Gemini Generation Complete');
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);

        // 4. Save to DB
        const { error } = await adminSupabase.from('video_study_guides').upsert([{
            video_id: videoId,
            explanation_lang: targetExplanationLang, // Save lang
            title: data.title,
            summary: data.summary,
            key_sentences: data.key_sentences,
            vocabulary: data.vocabulary,
            grammar: data.grammar,
            quiz: data.quiz
        }], { onConflict: 'video_id, explanation_lang' }); // Update conflict target

        if (error) throw error;

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('Study Guide Gen Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
