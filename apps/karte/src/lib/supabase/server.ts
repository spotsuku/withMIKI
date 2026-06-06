import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * サーバーコンポーネント / サーバーアクション用 Supabase クライアント。
 * Cookie からセッションを読み、RLS が効いた状態でクエリする。
 */
export function createClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ビルド時・未設定時でも import で落ちないようにフォールバック（実クエリ時に要設定）
  return createServerClient(url ?? 'http://localhost', anon ?? 'anon', {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // サーバーコンポーネントからの set は middleware 側で更新されるため無視可
        }
      },
    },
  });
}

/** 環境変数が設定済みかどうか（未設定時の案内表示用） */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
