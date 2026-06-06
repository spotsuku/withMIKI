import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson, aiConfigured } from '@/lib/ai/anthropic';
import { requireAiContext, logAiJob } from '@/lib/ai/runtime';

export const dynamic = 'force-dynamic';

interface KarteScan {
  patient?: {
    name?: string; kana?: string; dob?: string; sex?: string; blood_type?: string;
    tel?: string; email?: string; address?: string; job?: string;
  };
  intake?: { chief?: string; onset?: string; current?: string; history?: string; sleep?: string; appetite?: string; meds?: string; note?: string };
}

/** 紙のカルテ/問診票を撮影 → 患者基本情報＋問診を抽出 */
export async function POST(req: NextRequest) {
  const ctx = await requireAiContext();
  if (!ctx) return NextResponse.json({ error: '権限がありません' }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: 'AIが未設定です（ANTHROPIC_API_KEY）。' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { imageBase64?: string; mediaType?: string } | null;
  if (!body?.imageBase64) return NextResponse.json({ error: '画像がありません' }, { status: 400 });

  const system =
    '紙のカルテ・問診票の写真から情報を読み取る医療事務アシスタント。次の構造の JSON だけを返す:\n' +
    '{"patient":{"name","kana","dob"(YYYY-MM-DD),"sex","blood_type","tel","email","address","job"},' +
    '"intake":{"chief","onset","current","history","sleep","appetite","meds","note"}}\n' +
    '読み取れない項目は空文字。日付は西暦 YYYY-MM-DD に正規化。JSON 以外は出力しない。';

  try {
    const result = await callClaude({
      system, maxTokens: 1500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.imageBase64 } },
        { type: 'text', text: 'このカルテ/問診票の内容を JSON で返してください。' },
      ]}],
    });
    const parsed = (extractJson<KarteScan>(result.text) ?? {}) as KarteScan;
    await logAiJob(ctx, {
      type: 'karte_scan', model: result.model,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      status: 'succeeded', output: parsed,
    });
    return NextResponse.json({ patient: parsed.patient ?? {}, intake: parsed.intake ?? {} });
  } catch (e) {
    await logAiJob(ctx, { type: 'karte_scan', model: 'unknown', status: 'failed' });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
