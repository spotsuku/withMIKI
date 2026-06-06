import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson, aiConfigured } from '@/lib/ai/anthropic';
import { requireAiContext, logAiJob } from '@/lib/ai/runtime';

export const dynamic = 'force-dynamic';

interface IntakeResult {
  chief?: string; onset?: string; current?: string; history?: string;
  sleep?: string; appetite?: string; meds?: string; note?: string;
}

/** 問診票の画像から基本情報を抽出 */
export async function POST(req: NextRequest) {
  const ctx = await requireAiContext();
  if (!ctx) return NextResponse.json({ error: '権限がありません' }, { status: 401 });
  if (!aiConfigured()) {
    return NextResponse.json({ error: 'AIが未設定です（ANTHROPIC_API_KEY）。' }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as
    | { imageBase64?: string; mediaType?: string; patientId?: string }
    | null;
  if (!body?.imageBase64) return NextResponse.json({ error: '画像がありません' }, { status: 400 });

  const system =
    '問診票の画像から内容を読み取る医療事務アシスタント。次のキーの JSON だけを返す: ' +
    'chief(主訴), onset(発症時期), current(現病歴), history(既往歴), sleep(睡眠), ' +
    'appetite(食欲), meds(服薬), note(備考・禁忌)。読み取れない項目は空文字。JSON 以外は出力しない。';

  try {
    const result = await callClaude({
      system,
      maxTokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.imageBase64 } },
            { type: 'text', text: '問診票の内容を JSON で返してください。' },
          ],
        },
      ],
    });
    const parsed = (extractJson<IntakeResult>(result.text) ?? {}) as IntakeResult;
    await logAiJob(ctx, {
      type: 'intake_scan',
      patientId: body.patientId,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      status: 'succeeded',
      output: parsed,
    });
    return NextResponse.json({ intake: parsed });
  } catch (e) {
    await logAiJob(ctx, { type: 'intake_scan', patientId: body.patientId, model: 'unknown', status: 'failed' });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
