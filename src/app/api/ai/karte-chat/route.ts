import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callClaude, aiConfigured, type ClaudeMessage } from '@/lib/ai/anthropic';
import { requireAiContext, logAiJob } from '@/lib/ai/runtime';
import { ageFromDob } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** カルテ補助チャット。患者の文脈はサーバー側で構築（識別子は最小限）。 */
export async function POST(req: NextRequest) {
  const ctx = await requireAiContext();
  if (!ctx) return NextResponse.json({ error: '権限がありません' }, { status: 401 });
  if (!aiConfigured()) {
    return NextResponse.json({ error: 'AIが未設定です（ANTHROPIC_API_KEY）。' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as
    | { patientId?: string; message?: string; history?: { role: 'user' | 'assistant'; content: string }[] }
    | null;
  if (!body?.patientId || !body.message) {
    return NextResponse.json({ error: 'patientId と message が必要です' }, { status: 400 });
  }

  const supabase = createClient();
  // 文脈構築（RLS でテナント分離済み）。氏名等の直接識別子は送らない。
  const [patientRes, intakeRes, coverRes, visitsRes] = await Promise.all([
    supabase.from('patient').select('sex, dob').eq('id', body.patientId).maybeSingle(),
    supabase.from('patient_intake').select('chief, history, meds, note').eq('patient_id', body.patientId).maybeSingle(),
    supabase.from('karte_cover').select('goal, diagnosis, treatment, caution').eq('patient_id', body.patientId).maybeSingle(),
    supabase
      .from('visit')
      .select('visit_date, points, technique, treatments, memo')
      .eq('patient_id', body.patientId)
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
      .limit(3),
  ]);

  const pat = patientRes.data as { sex: string | null; dob: string | null } | null;
  const intake = intakeRes.data as Record<string, string | null> | null;
  const cover = coverRes.data as Record<string, string | null> | null;
  const visits = (visitsRes.data ?? []) as Record<string, unknown>[];
  const age = ageFromDob(pat?.dob ?? null);

  const context = [
    `患者: ${pat?.sex ?? '-'} ${age !== null ? age + '歳' : ''}`,
    `主訴: ${intake?.chief ?? '-'} / 既往: ${intake?.history ?? '-'} / 服薬: ${intake?.meds ?? '-'} / 禁忌: ${intake?.note ?? '-'}`,
    `方針: 目標=${cover?.goal ?? '-'} 診断=${cover?.diagnosis ?? '-'} 治療=${cover?.treatment ?? '-'} 注意=${cover?.caution ?? '-'}`,
    '直近の施術:',
    ...visits.map(
      (v) =>
        `・${v.visit_date}: 処置=${(v.treatments as string[] | null)?.join('・') ?? '-'} 取穴=${v.points ?? '-'} 手技=${v.technique ?? '-'} memo=${v.memo ?? '-'}`,
    ),
  ].join('\n');

  const system =
    'あなたは鍼灸・アスレティックトレーナーの臨床を補助するアシスタントです。' +
    '以下の患者文脈を踏まえ、簡潔で実務的な助言を日本語で行ってください。診断の断定は避け、必要に応じ受診勧奨を添えてください。\n\n' +
    `【患者文脈】\n${context}`;

  const messages: ClaudeMessage[] = [
    ...(body.history ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: body.message },
  ];

  try {
    const result = await callClaude({ system, messages, maxTokens: 1000 });
    await logAiJob(ctx, {
      type: 'karte_chat',
      patientId: body.patientId,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      status: 'succeeded',
    });
    return NextResponse.json({ reply: result.text });
  } catch (e) {
    await logAiJob(ctx, { type: 'karte_chat', patientId: body.patientId, model: 'unknown', status: 'failed' });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
