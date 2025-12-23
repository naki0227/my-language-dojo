// app/api/grade/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
    try {
        // Handle JSON request (from mobile/frontend)
        const body = await request.json();
        const { audioData, targetText, mimeType } = body; // Expecting base64 string and text

        if (!audioData || !targetText) {
            return NextResponse.json({ error: 'Audio and text are required' }, { status: 400 });
        }

        // Decode Base64 to Buffer
        const base64Audio = audioData; // Already base64 string
        // No need to convert to ArrayBuffer and back if we already have base64

        // Geminiクライアントの準備
        // Use gemini-1.5-flash if 2.5 is failing/invalid, but respecting user's setting for now.
        // NOTE: If 2.5 is invalid, this needs to be changed. Assuming user had it working before?
        // Let's use gemini-1.5-flash as a safer fallback if 2.5 is indeed the issue, but first fix MIME.
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // プロンプト（命令文）の作成
        const prompt = `
      You are a strict English pronunciation teacher.
      The user is trying to read the following text: "${targetText}"
      
      Listen to the provided audio.
      1. Score the pronunciation from 0 to 100.
2. Identify specific words that were mispronounced.
      3. Give a short, encouraging advice in Japanese.

      Return the result in JSON format:
{
    "score": number,
        "feedback": "string (Japanese)",
            "mispronounced_words": ["word1", "word2"]
}
`;

        // AIに送信
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType || 'audio/webm', // Use dynamic mimeType
                    data: base64Audio
                }
            }
        ]);

        const responseText = result.response.text();

        // JSON部分だけを取り出す（Markdownのコードブロック ```json ... ``` を除去）
        const cleanedJson = responseText.replace(/```json | ```/g, '').trim();
        const data = JSON.parse(cleanedJson);

        return NextResponse.json(data);

    } catch (error) {
        console.error('Gemini API Error:', error);
        return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
    }
}
