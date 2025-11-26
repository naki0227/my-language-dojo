import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ★自作AIスイッチ (将来的に true に切り替える)
const USE_CUSTOM_AI = false;

// AI処理の共通ロジック
async function handleGeminiRequest(type: string, payload: any) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = "";
    let responseFormat = {};

    switch (type) {
        case 'analyze':
            prompt = `Analyze the word "${payload.word}" in ${payload.targetLang} and translate it to Japanese. Output ONLY JSON with {translation, definition}.`;
            responseFormat = { responseMimeType: "application/json" };
            break;
        case 'generate_textbook':
            prompt = `Write a lesson for ${payload.subject} (Level ${payload.level}) about ${payload.topic}. Output ONLY Markdown.`;
            break;
        // ... 他の処理も追加
        default:
            return { error: 'Unknown AI function' };
    }

    try {
        const result = await model.generateContent(prompt, responseFormat);
        return { data: result.response.text() };
    } catch (e: any) {
        return { error: `Gemini Error: ${e.message}` };
    }
}

// ★メインのAIサービスゲートウェイ
export async function POST(request: Request) {
    try {
        const { type, payload } = await request.json();

        // 1. 自作AIを使う場合 (Phase 3以降)
        if (USE_CUSTOM_AI) {
            // 将来的にここに自作のASRモデルやNLPモデルを呼び出すロジックが入る
            return NextResponse.json({ data: "Running Custom AI (Not Yet Implemented)" });
        }

        // 2. Geminiを使う場合 (現状)
        const result = await handleGeminiRequest(type, payload);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ data: result.data });

    } catch (error) {
        return NextResponse.json({ error: 'System Error' }, { status: 500 });
    }
}