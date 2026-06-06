'use client';

import { createBrowserClient } from '@supabase/ssr';

/** クライアントコンポーネント用 Supabase クライアント。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon',
  );
}
