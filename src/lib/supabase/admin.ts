import { createClient as createSb, type SupabaseClient } from '@supabase/supabase-js';

/**
 * サーバー専用の管理クライアント（service role）。
 * RLS をバイパスするため、呼び出し側で必ず認証ユーザーのテナントを検証してから使うこと。
 * Storage アップロード等、anon キーでは行えない操作に限定。
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSb(url, key, { auth: { persistSession: false } });
}

export function adminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export const MEDIA_BUCKET = 'media';
