import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase'; // サーバー側でもsupabaseクライアントが必要
// @ts-ignore
import { Innertube, UniversalCache } from 'youtubei.js';

// ※注意: 本番環境でsupabaseを使うために、このファイル内でcreateClientする必要がありますが、
// 今回は簡易的にAPIルート内で直接RESTで叩くか、既存のクライアントをimportして使います。
// もし '@/lib/supabase' が 'use client' 前提で作られている場合は、
// ここで createClient をし直す必要があります。
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 本来はSERVICE_ROLE_KEY推奨ですがANONでもRLS無効ならOK
);

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // AI処理時間を確保

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const targetLang = searchParams.get('lang') || 'ja'; // デフォルト日本語
    const forceAi = searchParams.get('force') === 'true'; // 強制AI生成フラグ

    if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 });

    try {
        // 1. まずキャッシュ(DB)にあるか探す
        if (!forceAi) {
            const { data: cached } = await adminSupabase
                .from('cached_subtitles')
                .select('content')
                .match({ video_id: videoId, language: targetLang })
                .single();

            if (cached) {
                console.log(`[API] Returning cached subtitle for ${videoId} (${targetLang})`);
                return NextResponse.json(cached.content);
            }
        }

        // 2. キャッシュがない場合、YouTubeから生の字幕を取得
        console.log(`[API] Fetching raw transcript...`);
        const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        const info = await youtube.getInfo(videoId);
        const transcriptData = await info.getTranscript();

        // 生データを整形
        // @ts-ignore
        const rawLines = transcriptData.transcript.content.body.initial_segments.map((segment: any) => ({
            text: segment.snippet.text,
            offset: parseInt(segment.start_ms),
            duration: parseInt(segment.end_ms) - parseInt(segment.start_ms)
        }));

        // 字幕が長すぎる場合はAI処理を諦めて生データを返す（コスト削減・エラー回避）
        if (rawLines.length > 500) {
            console.log('[API] Transcript too long for AI, returning raw.');
            return NextResponse.json(rawLines);
        }

        // 3. Geminiに「整形と翻訳」を依頼
        console.log(`[API] Requesting AI fix & translate...`);
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        const prompt = `
      You are a professional subtitle editor.
      I will provide a raw YouTube transcript JSON. It has fragmented sentences.
      
      Please do the following:
      1. Combine fragmented words into proper, natural sentences.
      2. Translate each sentence into "${targetLang}" (Japanese).
      3. Keep the approximate "offset" (start time) of the first word in the sentence.
      4. Return a JSON array.

      Raw Input:
      ${JSON.stringify(rawLines)}

      Output Format (JSON only):
      [
        { "text": "Original English sentence.", "translation": "翻訳された日本語。", "offset": 1234, "duration": 5000 }
      ]
    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json|```/g, '').trim();
        const aiData = JSON.parse(responseText);

        // 4. 結果をDBに保存 (キャッシュ)
        await adminSupabase.from('cached_subtitles').insert({
            video_id: videoId,
            language: targetLang,
            content: aiData
        });

        console.log(`[API] Saved new cache.`);
        return NextResponse.json(aiData);

    } catch (error) {
        console.error('[API] Error:', error);
        return NextResponse.json({ error: 'Failed to process transcript' }, { status: 500 });
    }
}

