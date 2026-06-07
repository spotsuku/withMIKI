/**
 * 婦人科デイリーの保存処理（共通コア）。
 * ログイン版（saveDaily）と、ログイン不要トークン版（/r/[token]）の両方から使う。
 * 患者本人の自己記録（daily_record / gyneco_daily / selfcare / medication）のみを書き込み、
 * 先生のカルテ（visit/cover 等）には一切触れない＝先生の記入を患者が上書きしない。
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { GYNECO_CHIPS, GYNECO_EXTRA_CHIPS, SELFCARES, MEDS } from '@/lib/gyneco';

function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function arr(fd: FormData, k: string): string[] {
  const v = fd.get(k);
  if (!v) return [];
  try { const a = JSON.parse(String(v)); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

export async function persistDaily(
  db: SupabaseClient,
  patient: { id: string; tenant_id: string },
  fd: FormData,
): Promise<{ error?: string }> {
  const recordDate = str(fd, 'record_date') ?? new Date().toISOString().slice(0, 10);

  const payload: Record<string, unknown> = {};
  for (const g of GYNECO_EXTRA_CHIPS) {
    if (g.type === 'single') { const v = str(fd, `s_${g.key}`); if (v) payload[g.key] = v; }
    else { const a = arr(fd, `m_${g.key}`); if (a.length) payload[g.key] = a; }
  }

  const common = {
    tenant_id: patient.tenant_id,
    patient_id: patient.id,
    record_date: recordDate,
    source: 'patient',
    weight: num(fd, 'weight'),
    body_fat: num(fd, 'body_fat'),
    body_temp: num(fd, 'body_temp'),
    height: num(fd, 'height'),
    sbp: num(fd, 'sbp'),
    dbp: num(fd, 'dbp'),
    hr: num(fd, 'hr'),
    sleep_hours: num(fd, 'sleep_hours'),
    sleep_quality: str(fd, 'sleep_quality'),
    water: num(fd, 'water'),
    memo: str(fd, 'memo'),
    payload,
  };

  const gyneco: Record<string, unknown> = { bbt: num(fd, 'bbt'), pain: num(fd, 'pain') };
  for (const g of GYNECO_CHIPS) {
    if (!g.col) continue;
    if (g.type === 'single') gyneco[g.col] = str(fd, `s_${g.key}`);
    else gyneco[g.col] = arr(fd, `m_${g.key}`);
  }

  const { data: existing } = await db
    .from('daily_record').select('id')
    .eq('patient_id', patient.id).eq('record_date', recordDate).is('deleted_at', null)
    .limit(1).maybeSingle();

  let dailyId: string;
  if (existing) {
    dailyId = (existing as { id: string }).id;
    const { error } = await db.from('daily_record').update(common).eq('id', dailyId);
    if (error) return { error: '保存に失敗しました：' + error.message };
  } else {
    const { data, error } = await db.from('daily_record').insert(common).select('id').single();
    if (error || !data) return { error: '保存に失敗しました：' + (error?.message ?? '') };
    dailyId = (data as { id: string }).id;
  }

  const { error: gErr } = await db.from('gyneco_daily')
    .upsert({ daily_record_id: dailyId, ...gyneco }, { onConflict: 'daily_record_id' });
  if (gErr) return { error: '記録の保存に失敗しました：' + gErr.message };

  await db.from('selfcare_log').delete().eq('daily_record_id', dailyId);
  const scRows = SELFCARES.filter((sc) => fd.get(`sc_${sc.id}`) === 'on')
    .map((sc) => ({ daily_record_id: dailyId, selfcare_code: sc.id, done: true }));
  if (scRows.length) await db.from('selfcare_log').insert(scRows);

  const takenMeds = MEDS.filter((m) => fd.get(`med_${m}`) === 'on');
  await db.from('medication_log').delete().eq('daily_record_id', dailyId);
  for (const name of takenMeds) {
    const { data: med } = await db.from('medication')
      .upsert({ tenant_id: patient.tenant_id, patient_id: patient.id, name }, { onConflict: 'patient_id,name' })
      .select('id').single();
    if (med) await db.from('medication_log').insert({ daily_record_id: dailyId, medication_id: (med as { id: string }).id, taken: true });
  }
  return {};
}

/** トークン版ページ用に当日の初期値を読み込む */
export async function loadDailyInitial(db: SupabaseClient, patientId: string, date: string) {
  const { data: daily } = await db.from('daily_record')
    .select('id, weight, body_fat, body_temp, height, sbp, dbp, hr, sleep_hours, sleep_quality, water, memo, payload')
    .eq('patient_id', patientId).eq('record_date', date).is('deleted_at', null).maybeSingle();
  let gyneco: Record<string, unknown> = {};
  let selfcare: string[] = [];
  let meds: string[] = [];
  if (daily) {
    const did = (daily as { id: string }).id;
    const { data: g } = await db.from('gyneco_daily').select('*').eq('daily_record_id', did).maybeSingle();
    gyneco = (g as Record<string, unknown>) ?? {};
    const { data: sc } = await db.from('selfcare_log').select('selfcare_code, done').eq('daily_record_id', did);
    selfcare = ((sc ?? []) as { selfcare_code: string; done: boolean }[]).filter((r) => r.done).map((r) => r.selfcare_code);
    const { data: ml } = await db.from('medication_log').select('taken, medication:medication_id(name)').eq('daily_record_id', did);
    meds = ((ml ?? []) as { taken: boolean; medication: { name: string } | { name: string }[] | null }[])
      .filter((r) => r.taken).map((r) => (Array.isArray(r.medication) ? r.medication[0]?.name : r.medication?.name)).filter((x): x is string => !!x);
  }
  const d = (daily as Record<string, unknown> | null) ?? {};
  return {
    record_date: date, selfcare, meds,
    weight: (d.weight as number) ?? null, body_fat: (d.body_fat as number) ?? null, body_temp: (d.body_temp as number) ?? null,
    height: (d.height as number) ?? null, sbp: (d.sbp as number) ?? null, dbp: (d.dbp as number) ?? null, hr: (d.hr as number) ?? null,
    sleep_hours: (d.sleep_hours as number) ?? null, sleep_quality: (d.sleep_quality as string) ?? null,
    water: (d.water as number) ?? null, memo: (d.memo as string) ?? null,
    bbt: (gyneco?.bbt as number) ?? null, pain: (gyneco?.pain as number) ?? null,
    gyneco: gyneco ?? {}, payload: (d.payload as Record<string, unknown>) ?? {},
  };
}
