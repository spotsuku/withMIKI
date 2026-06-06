'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    return { error: 'メールアドレスとパスワードを入力してください。' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: 'ログインに失敗しました：' + error.message };
  }
  redirect('/patients');
}

/**
 * 開発用ワンクリックログイン。
 * サーバー環境変数 DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD が設定されている時だけ機能する。
 * 本番（Vercel）ではこれらを設定しなければ無効（押しても拒否）= 安全。
 */
export async function devLogin(_prev: unknown, _formData: FormData) {
  const email = process.env.DEV_LOGIN_EMAIL;
  const password = process.env.DEV_LOGIN_PASSWORD;
  if (!email || !password) {
    return { error: '開発用ログインは無効です（サーバーに DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD が未設定）。' };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: '開発用ログインに失敗しました：' + error.message };
  }
  redirect('/patients');
}
