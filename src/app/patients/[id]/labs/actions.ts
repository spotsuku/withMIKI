'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';

export interface LabFormState {
  error?: string;
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

interface ValueRow {
  test_code: string;
  value: number | null;
  value_text: string | null;
}

/** フォームから検査値の行を組み立てる（カタログのコード集合に対して lab_<code> を読む） */
function collectValues(formData: FormData, codes: string[]): ValueRow[] {
  const rows: ValueRow[] = [];
  for (const code of codes) {
    const raw = str(formData, `lab_${code}`);
    if (raw === null) continue;
    const n = parseFloat(raw.replace(/,/g, ''));
    if (Number.isFinite(n) && /^[-+]?[\d.,]+$/.test(raw)) {
      rows.push({ test_code: code, value: n, value_text: null });
    } else {
      rows.push({ test_code: code, value: null, value_text: raw });
    }
  }
  return rows;
}

/** 採血セットの新規作成 / 更新（手入力） */
export async function saveLab(_prev: LabFormState, formData: FormData): Promise<LabFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) return { error: 'アカウントがテナントにひも付いていません（app_user）。' };

  const patientId = str(formData, 'patientId');
  if (!patientId) return { error: '患者IDがありません。' };
  const takenDate = str(formData, 'taken_date');
  if (!takenDate) return { error: '採血日を入力してください。' };

  const labId = str(formData, 'labId'); // 空なら新規
  const supabase = createClient();

  // カタログのコード一覧をサーバー側で取得（クライアントを信用しない）
  const { data: catalog } = await supabase.from('lab_test_catalog').select('code');
  const codes = (catalog ?? []).map((c) => (c as { code: string }).code);
  const values = collectValues(formData, codes);

  const header = {
    tenant_id: ctx.appUser.tenant_id,
    patient_id: patientId,
    taken_date: takenDate,
    source: 'manual',
    comment: str(formData, 'comment'),
  };

  let savedId = labId;
  if (labId) {
    const { error } = await supabase.from('lab_result').update(header).eq('id', labId);
    if (error) return { error: '採血の更新に失敗しました：' + error.message };
    // 値を入れ替え
    await supabase.from('lab_value').delete().eq('lab_result_id', labId);
  } else {
    const { data, error } = await supabase.from('lab_result').insert(header).select('id').single();
    if (error || !data) return { error: '採血の作成に失敗しました：' + (error?.message ?? '') };
    savedId = (data as { id: string }).id;
  }

  if (values.length) {
    const { error } = await supabase
      .from('lab_value')
      .insert(values.map((v) => ({ ...v, lab_result_id: savedId })));
    if (error) return { error: '検査値の保存に失敗しました：' + error.message };
  }

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

/** 採血セットの論理削除 */
export async function deleteLab(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const patientId = str(formData, 'patientId');
  const labId = str(formData, 'labId');
  if (!patientId || !labId) return;
  const supabase = createClient();
  await supabase.from('lab_result').update({ deleted_at: new Date().toISOString() }).eq('id', labId);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
