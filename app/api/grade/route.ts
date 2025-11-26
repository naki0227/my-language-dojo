// app/api/grade/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
    try {
        // フォームデータから音声とテキストを取り出す
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;
        const referenceText = formData.get('text') as string;

        if (!audioFile || !referenceText) {
            return NextResponse.json({ error: 'Audio and text are required' }, { status: 400 });
        }

        // 音声ファイルをBase64形式に変換 (Geminiに送るため)
        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');

        // Geminiクライアントの準備
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // プロンプト（命令文）の作成
        const prompt = `
      You are a strict English pronunciation teacher.
      The user is trying to read the following text: "${referenceText}"
      
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
                    mimeType: 'audio/webm', // ブラウザの録音形式に合わせる
                    data: base64Audio
                }
            }
        ]);

        const responseText = result.response.text();

        // JSON部分だけを取り出す（Markdownのコードブロック ```json ... ``` を除去）
        const cleanedJson = responseText.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanedJson);

        return NextResponse.json(data);

    } catch (error) {
        console.error('Gemini API Error:', error);
        return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
    }
}
