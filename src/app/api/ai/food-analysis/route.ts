import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson, aiConfigured } from '@/lib/ai/anthropic';
import { requireAiContext, logAiJob } from '@/lib/ai/runtime';

export const dynamic = 'force-dynamic';

interface FoodResult {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  items?: string[];
  note?: string;
}

/** 食事写真からカロリー・PFC を推定 */
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
    '管理栄養士アシスタント。食事写真から推定栄養を JSON で返す。' +
    'キーは calories(kcal), protein(g), carbs(g), fat(g), items(料理名の配列), note。数値のみ。JSON 以外は出力しない。';

  try {
    const result = await callClaude({
      system,
      maxTokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.imageBase64 } },
            { type: 'text', text: 'この食事の推定栄養を JSON で返してください。' },
          ],
        },
      ],
    });

    const parsed = (extractJson<FoodResult>(result.text) ?? {}) as FoodResult;
    await logAiJob(ctx, {
      type: 'food_analysis',
      patientId: body.patientId,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      status: 'succeeded',
      output: parsed,
    });
    return NextResponse.json({ analysis: parsed });
  } catch (e) {
    await logAiJob(ctx, { type: 'food_analysis', patientId: body.patientId, model: 'unknown', status: 'failed' });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
