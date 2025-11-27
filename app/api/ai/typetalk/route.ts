import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { message, topic, typingTime } = await request.json();

        // 安定・高速な Gemini 2.5 Flash を使用
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });

        const systemPrompt = `
      You are an English conversation partner for a learner.
      Roleplay as a friendly native speaker.
      Current Topic: "${topic || 'Free Chat'}"
      
      User's message: "${message}"
      User's typing time: ${typingTime} seconds.
      
      Task:
      1. Reply to the user naturally to keep the conversation going. (Max 2 sentences)
      2. Evaluate the user's message based on:
         - Grammar (1-5): Is it grammatically correct?
         - Naturalness (1-5): Is it natural English phrasing?
         - Speed (1-5): Give 5 if typing time is under 5s, 3 if under 10s, 1 if over 15s.
      3. Provide a one-sentence feedback/correction in Japanese if there are mistakes or better ways to say it.
      
      Output Format (JSON):
      {
        "reply": "Your reply here.",
        "score": {
          "grammar": 5,
          "naturalness": 4,
          "speed": 3
        },
        "feedback": "Correction or advice here (in Japanese)."
      }
    `;

        const result = await model.generateContent(systemPrompt);
        const data = JSON.parse(result.response.text());

        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

