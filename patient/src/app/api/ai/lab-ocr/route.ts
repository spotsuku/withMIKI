import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callClaude, extractJson, aiConfigured } from '@/lib/ai/anthropic';
import { getPatientContext } from '@/lib/patient';

export const dynamic = 'force-dynamic';

/** 採血画像から検査値を抽出（患者本人） */
export async function POST(req: NextRequest) {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return NextResponse.json({ error: '権限がありません' }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: 'AIが未設定です（ANTHROPIC_API_KEY）。' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { imageBase64?: string; mediaType?: string } | null;
  if (!body?.imageBase64) return NextResponse.json({ error: '画像がありません' }, { status: 400 });

  const supabase = createClient();
  const { data: catalog } = await supabase.from('lab_test_catalog').select('code, name, unit').order('sort_order');
  const items = (catalog ?? []) as { code: string; name: string; unit: string | null }[];
  const codeSet = new Set(items.map((i) => i.code));
  const listing = items.map((i) => `${i.code}=${i.name}${i.unit ? `(${i.unit})` : ''}`).join(', ');

  const system =
    '採血結果の画像から検査値を読み取るアシスタント。指定コードに対応する数値だけを JSON で返す。' +
    '読み取れない項目は含めない。値は数値のみ。JSON 以外は出力しない。';
  const prompt = `対象項目（code=名称）: ${listing}\n読み取れた項目を {"code": 数値} の JSON で返してください。`;

  try {
    const result = await callClaude({
      system, maxTokens: 1500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.imageBase64 } },
        { type: 'text', text: prompt },
      ]}],
    });
    const parsed = extractJson<Record<string, unknown>>(result.text) ?? {};
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!codeSet.has(k)) continue;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isFinite(n)) values[k] = n;
    }
    return NextResponse.json({ values });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
