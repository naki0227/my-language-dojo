import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

// Supabaseクライアントの初期化 (管理者権限)
// 秘密鍵は環境変数から取得されます。
const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Next.jsのAPI設定: 動的レンダリングを強制し、実行時間を延長
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 実行時間最大120秒

// 教科書生成に必要なトピックリスト
const SUBJECT_TOPICS: Record<string, string[]> = {
    'English': [
        'Basic Greetings and Pronunciation in English',
        'Essential Grammar Rules (Present Tense)',
        'Simple Conversation Starters (Ordering Food)',
    ],
    'Spanish': [
        'Basic Spanish Pronunciation and Greetings',
        'Conjugation of "Ser" and "Estar"',
        'Simple Questions and Answers in Spanish',
    ],
    'Programming': [
        'What is a Variable and Data Type (Python)',
        'Understanding Loops (For and While)',
        'Basic Function Definition and Calling',
    ],
    'Sign Language': [
        'Basic Signs for Greetings and Introductions',
        'The Alphabet and Simple Finger Spelling',
        'Signs for Family Members and Daily Needs',
    ]
};


export async function POST(request: Request) {
    try {
        const { subject } = await request.json();

        if (!subject) {
            return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
        }

        // Gemini APIクライアントの初期化
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // 生成するトピックを取得
        const textbookTopics = SUBJECT_TOPICS[subject] || SUBJECT_TOPICS['English'];
        let textbookCount = 0;

        console.log(`[BULK] Starting textbook generation for: ${subject}`);

        for (const topic of textbookTopics) {
            const contentPrompt = `
            You are writing a beginner textbook for ${subject} learners.
            Write a detailed Markdown lesson about "${topic}". The language for explanation must be Japanese.
            
            Requirements:
            1. Title must be Level 1 Header (# ).
            2. Explain clearly in Japanese.
            3. Include a relevant YouTube video example using the format: [[video:VIDEO_ID:START_SECONDS:TITLE]]. If you cannot find a specific ID, use a placeholder [[video:PLACEHOLDERID:0:Sample Video Title]].
            Output ONLY the Markdown content.
        `;

            const contentResult = await model.generateContent(contentPrompt);
            // マークダウンのコードブロックを削除して純粋なコンテンツを取得
            const content = contentResult.response.text().replace(/```markdown|```/g, '').trim();

            // DBに登録
            const { error } = await adminSupabase.from('textbooks').insert([{
                title: `入門編 Vol.${textbookCount + 1}: ${topic}`,
                content: content,
                subject: subject // 言語を保存
            }]);

            if (error) {
                console.error(`[BULK] Supabase Error for ${topic}:`, error);
                throw new Error(`Database insert failed for ${topic}: ${error.message}`);
            }

            textbookCount++;
            console.log(`[BULK] Generated and saved: ${topic}`);
        }

        return NextResponse.json({
            success: true,
            textbooks: textbookCount,
            message: `Textbook generation for ${subject} complete!`
        });

    } catch (error: any) {
        console.error('[BULK] Fatal Error:', error);
        // 詳細なエラーメッセージをクライアントに返します。
        return NextResponse.json({ error: `教科書生成中にエラーが発生しました: ${error.message}` }, { status: 500 });
    }
}

