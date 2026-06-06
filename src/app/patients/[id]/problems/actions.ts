'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';

export interface ProblemFormState {
  error?: string;
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** 問題の新規作成 / 更新 */
export async function saveProblem(
  _prev: ProblemFormState,
  formData: FormData,
): Promise<ProblemFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) return { error: 'アカウントがテナントにひも付いていません（app_user）。' };

  const patientId = str(formData, 'patientId');
  if (!patientId) return { error: '患者IDがありません。' };
  const title = str(formData, 'title');
  if (!title) return { error: '問題名（タイトル）を入力してください。' };

  const problemId = str(formData, 'problemId'); // 空なら新規
  const supabase = createClient();

  const payload = {
    tenant_id: ctx.appUser.tenant_id,
    patient_id: patientId,
    title,
    category: str(formData, 'category'),
    diagnosis: str(formData, 'diagnosis'),
    onset: str(formData, 'onset'),
    detail: str(formData, 'detail'),
    status: str(formData, 'status') ?? 'active',
  };

  let savedId = problemId;
  if (problemId) {
    const { error } = await supabase.from('problem').update(payload).eq('id', problemId);
    if (error) return { error: '問題の更新に失敗しました：' + error.message };
  } else {
    const { data, error } = await supabase.from('problem').insert(payload).select('id').single();
    if (error || !data) return { error: '問題の作成に失敗しました：' + (error?.message ?? '') };
    savedId = (data as { id: string }).id;
  }

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/problems/${savedId}/edit`);
}

/** 問題の論理削除 */
export async function deleteProblem(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const patientId = str(formData, 'patientId');
  const problemId = str(formData, 'problemId');
  if (!patientId || !problemId) return;
  const supabase = createClient();
  await supabase.from('problem').update({ deleted_at: new Date().toISOString() }).eq('id', problemId);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

/** 問題にひも付く SOAP ノートの追加 */
export async function addProblemSoap(
  _prev: ProblemFormState,
  formData: FormData,
): Promise<ProblemFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) return { error: 'アカウントがテナントにひも付いていません（app_user）。' };

  const patientId = str(formData, 'patientId');
  const problemId = str(formData, 'problemId');
  if (!patientId || !problemId) return { error: '対象が不明です。' };

  const noteDate = str(formData, 'note_date');
  if (!noteDate) return { error: '日付を入力してください。' };

  const soap = {
    s: str(formData, 'soap_s'),
    o: str(formData, 'soap_o'),
    a: str(formData, 'soap_a'),
    p: str(formData, 'soap_p'),
  };
  if (!soap.s && !soap.o && !soap.a && !soap.p) {
    return { error: 'SOAP のいずれかを入力してください。' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('soap_note').insert({
    tenant_id: ctx.appUser.tenant_id,
    patient_id: patientId,
    problem_id: problemId,
    note_date: noteDate,
    ...soap,
    created_by: ctx.appUser.id,
  });
  if (error) return { error: 'SOAP の保存に失敗しました：' + error.message };

  revalidatePath(`/patients/${patientId}/problems/${problemId}/edit`);
  redirect(`/patients/${patientId}/problems/${problemId}/edit`);
}

/** SOAP ノートの削除 */
export async function deleteSoap(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return;
  const patientId = str(formData, 'patientId');
  const problemId = str(formData, 'problemId');
  const soapId = str(formData, 'soapId');
  if (!soapId) return;
  const supabase = createClient();
  await supabase.from('soap_note').delete().eq('id', soapId);
  revalidatePath(`/patients/${patientId}/problems/${problemId}/edit`);
  redirect(`/patients/${patientId}/problems/${problemId}/edit`);
}
