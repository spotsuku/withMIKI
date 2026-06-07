import { getUserContext, type UserContext } from '@/lib/auth';
import { getPatientContext } from '@/lib/patient';
import { createClient } from '@/lib/supabase/server';

/** AI ルートの共通: 先生（テナント所属）または患者本人を許可。未充足なら null。 */
export async function requireAiContext(): Promise<UserContext | null> {
  const ctx = await getUserContext();
  if (ctx?.appUser) return ctx;
  // 患者本人でも利用可（監査ログは appUser=null のためスキップ）
  const pc = await getPatientContext();
  if (pc?.patient) return { user: pc.user, appUser: null };
  return null;
}

/** AI 利用の監査ログ（ai_job）を記録する。失敗しても本処理は止めない。 */
export async function logAiJob(
  ctx: UserContext,
  args: {
    type: string;
    patientId?: string | null;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    status: 'succeeded' | 'failed';
    output?: unknown;
  },
): Promise<void> {
  if (!ctx.appUser) return;
  try {
    const supabase = createClient();
    await supabase.from('ai_job').insert({
      tenant_id: ctx.appUser.tenant_id,
      patient_id: args.patientId ?? null,
      type: args.type,
      model: args.model,
      input_tokens: args.inputTokens ?? null,
      output_tokens: args.outputTokens ?? null,
      status: args.status,
      output: args.output ?? null,
      created_by: ctx.appUser.id,
    });
  } catch {
    // 監査ログ失敗は本処理に影響させない
  }
}
