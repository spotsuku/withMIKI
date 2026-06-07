'use server';

import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { persistDaily } from '@/lib/dailySave';

export interface RecordState { error?: string; ok?: boolean }

function hashPin(token: string, pin: string): string {
  return createHash('sha256').update(`${token}:${pin}`).digest('hex');
}

type TokenRow = { id: string; tenant_id: string; patient_id: string; pin_hash: string | null; revoked: boolean };

async function loadToken(admin: NonNullable<ReturnType<typeof createAdminClient>>, token: string): Promise<TokenRow | null> {
  const { data } = await admin.from('patient_record_token').select('id, tenant_id, patient_id, pin_hash, revoked').eq('token', token).maybeSingle();
  const row = data as TokenRow | null;
  if (!row || row.revoked) return null;
  return row;
}

/** 初回PIN設定（未設定時のみ） */
export async function setRecordPin(token: string, pin: string): Promise<RecordState> {
  if (!/^\d{4,8}$/.test(pin)) return { error: 'PINは4〜8桁の数字で設定してください。' };
  const admin = createAdminClient();
  if (!admin) return { error: 'サーバー設定が未完了です。' };
  const row = await loadToken(admin, token);
  if (!row) return { error: 'このURLは無効です。先生に再発行をご依頼ください。' };
  if (row.pin_hash) return { error: '既にPINが設定されています。PINを入力してください。' };
  await admin.from('patient_record_token').update({ pin_hash: hashPin(token, pin), last_used_at: new Date().toISOString() }).eq('id', row.id);
  return { ok: true };
}

/** PIN照合 */
export async function verifyRecordPin(token: string, pin: string): Promise<RecordState> {
  const admin = createAdminClient();
  if (!admin) return { error: 'サーバー設定が未完了です。' };
  const row = await loadToken(admin, token);
  if (!row) return { error: 'このURLは無効です。' };
  if (!row.pin_hash || row.pin_hash !== hashPin(token, pin)) return { error: 'PINが違います。' };
  await admin.from('patient_record_token').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);
  return { ok: true };
}

/** トークン＋PINで当日の記録を保存（毎回PINを検証） */
export async function saveRecordByToken(_prev: RecordState, fd: FormData): Promise<RecordState> {
  const token = String(fd.get('rt_token') ?? '');
  const pin = String(fd.get('rt_pin') ?? '');
  const admin = createAdminClient();
  if (!admin) return { error: 'サーバー設定が未完了です。' };
  const row = await loadToken(admin, token);
  if (!row) return { error: 'このURLは無効です。' };
  if (!row.pin_hash || row.pin_hash !== hashPin(token, pin)) return { error: 'PINが違います。再度PINを入力してください。' };

  // 患者の自己記録のみ書き込み（先生のカルテ＝visit/cover等には触れない）
  const r = await persistDaily(admin, { id: row.patient_id, tenant_id: row.tenant_id }, fd);
  if (r.error) return { error: r.error };
  await admin.from('patient_record_token').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);
  return { ok: true };
}

/** 途中からLINEログインに切り替える：この患者の招待トークンを発行して返す */
export async function linkLineFromRecord(token: string, pin: string): Promise<{ inviteToken?: string; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { error: 'サーバー設定が未完了です。' };
  const row = await loadToken(admin, token);
  if (!row) return { error: 'このURLは無効です。' };
  if (!row.pin_hash || row.pin_hash !== hashPin(token, pin)) return { error: 'PINが違います。' };

  // 既に連携済みなら不要
  const { data: linked } = await admin.from('patient_user').select('id').eq('patient_id', row.patient_id).maybeSingle();
  if (linked) return { error: 'この方は既にLINE/アカウント連携済みです。ログイン画面からLINEでログインしてください。' };

  // 未使用・未期限の招待があれば再利用、無ければ発行
  const { data: ex } = await admin.from('patient_invite').select('token').eq('patient_id', row.patient_id).is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
  let inviteToken = (ex as { token: string } | null)?.token ?? null;
  if (!inviteToken) {
    inviteToken = randomBytes(24).toString('hex');
    const { error } = await admin.from('patient_invite').insert({ tenant_id: row.tenant_id, patient_id: row.patient_id, token: inviteToken });
    if (error) return { error: '連携準備に失敗しました：' + error.message };
  }
  return { inviteToken };
}
