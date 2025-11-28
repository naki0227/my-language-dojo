import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
    try {
        const { word, targetLang } = await request.json();

        if (!word) {
            return NextResponse.json({ error: 'Word is required' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        // Prompt for dictionary definition
        const prompt = `
        Role: You are a helpful dictionary assistant for a language learner.
        Task: Translate the word "${word}" into Japanese.
        
        Context:
        - Source Language: ${targetLang || 'Auto-detect'}
        - Target Language: Japanese
        
        Instructions:
        1. Provide the meaning in Japanese.
        2. If the word is a conjugated verb or declined noun, provide the base form in parentheses.
        3. Keep the response concise (under 100 characters) for a popup bubble.
        
        Output Format (JSON):
        {
            "translation": "Japanese meaning (Base form)"
        }
        `;

        const result = await model.generateContent(prompt);
        const response = JSON.parse(result.response.text());

        return NextResponse.json({
            translation: response.translation
        });

    } catch (error: any) {
        console.error('Analyze Error:', error);
        return NextResponse.json({ error: 'Failed to analyze word' }, { status: 500 });
    }
}
