import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedImport, LabResult, DailyRecord } from './model.ts';

/**
 * 正規化モデルを Supabase(PostgreSQL) へ投入するローダ。
 * - 依存関係順に insert し、生成 ID で FK をひも付ける。
 * - 変換ロジック(transform)とは分離。テストは transform 側で行う。
 *
 * 前提: schema.sql + migrations(0001..0003) 適用済み。
 * RLS のため service role キー、または app.tenant_id を設定したセッションで実行すること。
 */

export interface LoadContext {
  url: string;
  serviceRoleKey: string;
  tenantId: string;
  /** 既定ケアプログラム ID（gyneco/athlete/master）。未指定なら code から解決 */
  careProgramId?: string;
  createdBy?: string | null;
}

export interface LoadResult {
  patientId: string;
  counts: Record<string, number>;
}

function client(ctx: LoadContext): SupabaseClient {
  return createClient(ctx.url, ctx.serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
}

/** sourceKind → 既定ケアプログラム code */
function programCode(n: NormalizedImport): string {
  if (n.sourceKind.startsWith('gyneco')) return 'gyneco';
  if (n.sourceKind.startsWith('athlete')) return 'athlete';
  return 'master';
}

export async function loadToSupabase(
  n: NormalizedImport,
  ctx: LoadContext,
): Promise<LoadResult> {
  const sb = client(ctx);
  const counts: Record<string, number> = {};
  const tenant = ctx.tenantId;

  // ケアプログラム ID 解決
  let careProgramId = ctx.careProgramId ?? null;
  if (!careProgramId) {
    const { data } = await sb
      .from('care_program')
      .select('id')
      .eq('code', programCode(n))
      .is('tenant_id', null)
      .limit(1)
      .maybeSingle();
    careProgramId = (data as { id: string } | null)?.id ?? null;
  }

  // 1) patient
  const { data: pat, error: pe } = await sb
    .from('patient')
    .insert({ ...n.patient, tenant_id: tenant, created_by: ctx.createdBy ?? null })
    .select('id')
    .single();
  if (pe) throw new Error(`patient insert failed: ${pe.message}`);
  const patientId = (pat as { id: string }).id;
  counts.patient = 1;

  // 2) intake / cover
  if (n.intake) {
    await sb.from('patient_intake').insert({ ...n.intake, patient_id: patientId, tenant_id: tenant });
    counts.intake = 1;
  }
  if (n.cover) {
    await sb.from('karte_cover').insert({ ...n.cover, patient_id: patientId, tenant_id: tenant });
    counts.cover = 1;
  }

  // 3) patient_program
  if (careProgramId) {
    await sb.from('patient_program').insert({
      tenant_id: tenant, patient_id: patientId, care_program_id: careProgramId, is_primary: true,
    });
  }

  // 4) medication マスタ（患者単位で一意化）
  const medNames = new Map<string, boolean>(); // name -> is_custom
  for (const d of n.dailyRecords) {
    for (const m of d.medications ?? []) {
      if (!medNames.has(m.name)) medNames.set(m.name, m.is_custom);
    }
  }
  const medIdByName = new Map<string, string>();
  for (const [name, isCustom] of medNames) {
    const { data } = await sb
      .from('medication')
      .insert({ tenant_id: tenant, patient_id: patientId, name, is_custom: isCustom })
      .select('id')
      .single();
    if (data) medIdByName.set(name, (data as { id: string }).id);
  }
  counts.medication = medIdByName.size;

  // 5) daily_record + 拡張
  counts.daily_record = 0;
  for (const d of n.dailyRecords) {
    const dailyId = await insertDaily(sb, d, patientId, tenant, careProgramId, medIdByName);
    if (dailyId) counts.daily_record++;
  }

  // 6) lab_result + lab_value
  counts.lab_result = await insertLabs(sb, n.labResults, patientId, tenant);

  // 7) training / nutrition / food
  for (const t of n.trainingSessions) {
    await sb.from('training_session').insert({ ...t, tenant_id: tenant, patient_id: patientId });
  }
  counts.training_session = n.trainingSessions.length;

  if (n.nutritionGoal) {
    await sb.from('nutrition_goal').insert({ ...n.nutritionGoal, tenant_id: tenant, patient_id: patientId });
    counts.nutrition_goal = 1;
  }
  for (const f of n.foodEntries) {
    await sb.from('food_entry').insert({ ...f, tenant_id: tenant, patient_id: patientId });
  }
  counts.food_entry = n.foodEntries.length;

  // 8) problems（ref → id）→ soaps
  const problemIdByRef = new Map<string, string>();
  for (const p of n.problems) {
    const { data } = await sb
      .from('problem')
      .insert({
        tenant_id: tenant, patient_id: patientId,
        title: p.title, category: p.category, diagnosis: p.diagnosis,
        onset: p.onset, detail: p.detail, status: p.status ?? 'active',
        source_ref: p.source_ref ?? null,
      })
      .select('id')
      .single();
    if (data) problemIdByRef.set(p.ref, (data as { id: string }).id);
  }
  counts.problem = problemIdByRef.size;

  for (const s of n.soaps) {
    await sb.from('soap_note').insert({
      tenant_id: tenant, patient_id: patientId,
      problem_id: s.problem_ref ? problemIdByRef.get(s.problem_ref) ?? null : null,
      note_date: s.note_date, s: s.s, o: s.o, a: s.a, p: s.p,
    });
  }
  counts.soap_note = n.soaps.length;

  // 9) visits + vital + soap
  counts.visit = 0;
  for (const v of n.visits) {
    const { data, error } = await sb
      .from('visit')
      .insert({
        tenant_id: tenant, patient_id: patientId, visit_date: v.visit_date,
        injury_part: v.injury_part, injury_name: v.injury_name,
        disorder_part: v.disorder_part, disorder_name: v.disorder_name,
        points: v.points, technique: v.technique,
        treatments: v.treatments ?? [], memo: v.memo,
      })
      .select('id')
      .single();
    if (error || !data) continue;
    const visitId = (data as { id: string }).id;
    counts.visit++;
    if (v.vital) {
      await sb.from('visit_vital').insert({ ...v.vital, visit_id: visitId, tenant_id: tenant });
    }
    if (v.soap) {
      await sb.from('soap_note').insert({
        tenant_id: tenant, patient_id: patientId, visit_id: visitId,
        note_date: v.visit_date, ...v.soap,
      });
    }
  }

  // 10) body diagrams / media
  for (const b of n.bodyDiagrams) {
    await sb.from('body_diagram').insert({
      tenant_id: tenant, patient_id: patientId, view: b.view, marks: b.marks, note: b.note,
    });
  }
  counts.body_diagram = n.bodyDiagrams.length;

  for (const m of n.media) {
    await sb.from('media').insert({ ...m, tenant_id: tenant, patient_id: patientId });
  }
  counts.media = n.media.length;

  return { patientId, counts };
}

async function insertDaily(
  sb: SupabaseClient,
  d: DailyRecord,
  patientId: string,
  tenant: string,
  careProgramId: string | null,
  medIdByName: Map<string, string>,
): Promise<string | null> {
  const { gyneco, athlete, selfcare, medications, ...common } = d;
  const { data, error } = await sb
    .from('daily_record')
    .insert({
      ...common, tenant_id: tenant, patient_id: patientId,
      care_program_id: careProgramId, source: 'import',
    })
    .select('id')
    .single();
  if (error || !data) return null;
  const dailyId = (data as { id: string }).id;

  if (gyneco) await sb.from('gyneco_daily').insert({ ...gyneco, daily_record_id: dailyId });
  if (athlete) await sb.from('athlete_daily').insert({ ...athlete, daily_record_id: dailyId });
  if (selfcare?.length) {
    await sb.from('selfcare_log').insert(
      selfcare.map((s) => ({ ...s, daily_record_id: dailyId })),
    );
  }
  if (medications?.length) {
    const rows = medications
      .map((m) => ({ daily_record_id: dailyId, medication_id: medIdByName.get(m.name), taken: m.taken }))
      .filter((r) => r.medication_id);
    if (rows.length) await sb.from('medication_log').insert(rows);
  }
  return dailyId;
}

async function insertLabs(
  sb: SupabaseClient,
  labs: LabResult[],
  patientId: string,
  tenant: string,
): Promise<number> {
  let n = 0;
  for (const lab of labs) {
    const { data, error } = await sb
      .from('lab_result')
      .insert({
        tenant_id: tenant, patient_id: patientId,
        taken_date: lab.taken_date, source: lab.source, comment: lab.comment,
      })
      .select('id')
      .single();
    if (error || !data) continue;
    const labId = (data as { id: string }).id;
    if (lab.values.length) {
      await sb.from('lab_value').insert(
        lab.values.map((v) => ({ ...v, lab_result_id: labId })),
      );
    }
    n++;
  }
  return n;
}
