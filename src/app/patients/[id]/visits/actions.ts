'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { TREATMENT_OPTIONS, VITAL_FIELDS } from '@/lib/constants';

export interface VisitFormState {
  error?: string;
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function numv(fd: FormData, k: string): number | null {
  const s = str(fd, k);
  if (s === null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** 施術記録の新規作成 / 更新（SOAP・バイタル込み） */
export async function saveVisit(
  _prev: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) {
    return { error: 'アカウントがテナントにひも付いていません（app_user）。docs/setup/supabase-setup.md §4 を参照。' };
  }

  const patientId = str(formData, 'patientId');
  if (!patientId) return { error: '患者IDがありません。' };
  const visitId = str(formData, 'visitId'); // 空なら新規
  const tenant = ctx.appUser.tenant_id;
  const supabase = createClient();

  const visitDate = str(formData, 'visit_date');
  if (!visitDate) return { error: '施術日を入力してください。' };

  const treatments = TREATMENT_OPTIONS.filter((t) => formData.get(`tx_${t}`) === 'on');

  const visitPayload = {
    tenant_id: tenant,
    patient_id: patientId,
    visit_date: visitDate,
    injury_part: str(formData, 'injury_part'),
    injury_name: str(formData, 'injury_name'),
    disorder_part: str(formData, 'disorder_part'),
    disorder_name: str(formData, 'disorder_name'),
    points: str(formData, 'points'),
    technique: str(formData, 'technique'),
    treatments,
    memo: str(formData, 'memo'),
  };

  let savedVisitId = visitId;

  if (visitId) {
    const { error } = await supabase.from('visit').update(visitPayload).eq('id', visitId);
    if (error) return { error: '施術記録の更新に失敗しました：' + error.message };
  } else {
    const { data, error } = await supabase
      .from('visit')
      .insert({ ...visitPayload, created_by: ctx.appUser.id })
      .select('id')
      .single();
    if (error || !data) return { error: '施術記録の作成に失敗しました：' + (error?.message ?? '') };
    savedVisitId = (data as { id: string }).id;
  }

  // バイタル（visit_vital）upsert
  const vital: Record<string, number | null | string> = { visit_id: savedVisitId!, tenant_id: tenant };
  let hasVital = false;
  for (const f of VITAL_FIELDS) {
    const val = numv(formData, `v_${f.key}`);
    vital[f.key] = val;
    if (val !== null) hasVital = true;
  }
  if (hasVital) {
    const { error } = await supabase.from('visit_vital').upsert(vital, { onConflict: 'visit_id' });
    if (error) return { error: 'バイタルの保存に失敗しました：' + error.message };
  }

  // SOAP（この施術にひも付く soap_note を 1 件 upsert）
  const soap = {
    s: str(formData, 'soap_s'),
    o: str(formData, 'soap_o'),
    a: str(formData, 'soap_a'),
    p: str(formData, 'soap_p'),
  };
  const soapHasContent = soap.s || soap.o || soap.a || soap.p;
  const { data: existingSoap } = await supabase
    .from('soap_note')
    .select('id')
    .eq('visit_id', savedVisitId!)
    .limit(1)
    .maybeSingle();

  if (soapHasContent) {
    if (existingSoap) {
      await supabase
        .from('soap_note')
        .update({ ...soap, note_date: visitDate })
        .eq('id', (existingSoap as { id: string }).id);
    } else {
      await supabase.from('soap_note').insert({
        tenant_id: tenant,
        patient_id: patientId,
        visit_id: savedVisitId,
        note_date: visitDate,
        ...soap,
        created_by: ctx.appUser.id,
      });
    }
  } else if (existingSoap) {
    // 内容が空になったら削除（論理削除列はないため物理削除）
    await supabase.from('soap_note').delete().eq('id', (existingSoap as { id: string }).id);
  }

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

/** 施術記録の論理削除 */
export async function deleteVisit(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const patientId = str(formData, 'patientId');
  const visitId = str(formData, 'visitId');
  if (!patientId || !visitId) return;
  const supabase = createClient();
  await supabase.from('visit').update({ deleted_at: new Date().toISOString() }).eq('id', visitId);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
