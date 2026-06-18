'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';
import { lineEnabled, linePushResult } from '@/lib/notify';

/** 管理者が自分のLINEへテスト通知を送る（疎通確認用） */
export async function sendTestLine(): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getUserContext();
  if (!ctx?.appUser) return { error: 'アカウントが未設定です。' };
  if (!lineEnabled()) return { error: 'サーバーに LINE_CHANNEL_ACCESS_TOKEN が未設定です（Vercelの環境変数を確認）。' };

  const supabase = createClient();
  const { data } = await supabase.from('app_user').select('line_user_id').eq('id', ctx.appUser.id).maybeSingle();
  const lid = (data as { line_user_id: string | null } | null)?.line_user_id;
  if (!lid) return { error: 'LINE未連携です。先に「LINEログイン連携」を実行してください。' };

  const r = await linePushResult(lid, '【テスト通知】WithMIKI から届いています。予約が入ると、この形式で先生のLINEに通知されます。');
  if (!r.ok) {
    let hint = '';
    if (r.status === 403) hint = '（先生が公式アカウントを友だち追加していない可能性）';
    else if (r.status === 400) hint = '（ユーザーIDがMessagingチャネルと不一致の可能性。ログイン用とMessagingが同一プロバイダーか確認）';
    else if (r.status === 401) hint = '（アクセストークンが無効）';
    return { error: `送信失敗 (${r.status ?? '?'}) ${hint}：${r.error ?? ''}` };
  }
  return { ok: true };
}
