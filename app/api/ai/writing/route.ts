import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { text, topic, targetSubject } = await request.json();
        const subject = targetSubject || 'English';

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        const prompt = `
      You are a professional language teacher of ${subject}.
      The student has written a short essay about "${topic}".
      
      Student's Text:
      "${text}"

      Task:
      1. Correct any grammatical errors.
      2. Suggest more natural phrasing (Native-like expressions).
      3. Give a score (0-100) based on clarity and grammar.
      4. Provide feedback in Japanese.

      Output JSON:
      {
        "corrected": "Corrected full text here...",
        "feedback": "Feedback in Japanese...",
        "score": 85,
        "points": ["Good point 1", "Correction point 1"]
      }
    `;

        const result = await model.generateContent(prompt);
        const data = JSON.parse(result.response.text());

        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

