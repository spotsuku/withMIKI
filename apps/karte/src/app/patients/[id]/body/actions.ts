'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';

export interface BodyFormState {
  error?: string;
  ok?: boolean;
}

/** 人体図（front/back）の保存。patient_id + view 単位で1行を upsert 相当に扱う。 */
export async function saveBodyDiagram(
  _prev: BodyFormState,
  formData: FormData,
): Promise<BodyFormState> {
  const ctx = await getUserContext();
  if (!ctx) return { error: 'ログインが必要です。' };
  if (!ctx.appUser) return { error: 'アカウントがテナントにひも付いていません（app_user）。' };

  const patientId = String(formData.get('patientId') ?? '');
  const view = String(formData.get('view') ?? '');
  if (!patientId || (view !== 'front' && view !== 'back')) {
    return { error: '対象が不正です。' };
  }
  const note = (formData.get('note') as string | null)?.trim() || null;
  let marks: unknown = [];
  try {
    marks = JSON.parse(String(formData.get('marks') ?? '[]'));
  } catch {
    marks = [];
  }

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('body_diagram')
    .select('id')
    .eq('patient_id', patientId)
    .eq('view', view)
    .is('visit_id', null)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('body_diagram')
      .update({ marks, note })
      .eq('id', (existing as { id: string }).id);
    if (error) return { error: '保存に失敗しました：' + error.message };
  } else {
    const { error } = await supabase.from('body_diagram').insert({
      tenant_id: ctx.appUser.tenant_id,
      patient_id: patientId,
      view,
      marks,
      note,
    });
    if (error) return { error: '保存に失敗しました：' + error.message };
  }

  revalidatePath(`/patients/${patientId}/body`);
  redirect(`/patients/${patientId}`);
}
