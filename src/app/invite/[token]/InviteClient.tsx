'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window {
    liff?: {
      init: (c: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getIDToken: () => string | null;
    };
  }
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

export function InviteClient({ token, patientName }: { token: string; patientName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'password'>('choose');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function lineLogin() {
    if (!LIFF_ID) { setMsg('LINEログインが未設定です（NEXT_PUBLIC_LIFF_ID）。メール・パスワードで登録してください。'); return; }
    setBusy(true); setMsg('LINEを準備中…');
    try {
      if (!window.liff) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('LIFF SDK の読み込みに失敗しました。'));
          document.body.appendChild(s);
        });
      }
      const liff = window.liff!;
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) { liff.login(); return; }
      const idToken = liff.getIDToken();
      if (!idToken) { setMsg('LINEのIDトークンを取得できませんでした。'); setBusy(false); return; }
      setMsg('連携中…');
      const res = await fetch('/api/invite/line', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, idToken }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error || '連携に失敗しました'); setBusy(false); return; }
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email: json.email, token: json.otp, type: 'magiclink' });
      if (error) { setMsg('セッション確立に失敗しました：' + error.message); setBusy(false); return; }
      router.push('/today'); router.refresh();
    } catch (e) {
      setMsg('エラー：' + (e as Error).message); setBusy(false);
    }
  }

  async function passwordRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/invite/claim', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error || '登録に失敗しました'); setBusy(false); return; }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setMsg('ログインに失敗しました：' + error.message); setBusy(false); return; }
      router.push('/today'); router.refresh();
    } catch (e) {
      setMsg('エラー：' + (e as Error).message); setBusy(false);
    }
  }

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI へようこそ</h2>
        <p className="meta">{patientName} さんのアカウントを設定します。ログイン方法を選んでください。</p>

        {mode === 'choose' ? (
          <>
            <button className="btn" style={{ width: '100%', background: '#06c755', marginBottom: 10 }} onClick={lineLogin} disabled={busy}>
              LINEでログイン
            </button>
            <button className="btn secondary" style={{ width: '100%' }} onClick={() => setMode('password')} disabled={busy}>
              メール・パスワードで登録
            </button>
          </>
        ) : (
          <form onSubmit={passwordRegister}>
            <div className="field">
              <label htmlFor="email">メールアドレス</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">パスワード（6文字以上）</label>
              <input id="password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn" type="submit" style={{ width: '100%' }} disabled={busy}>{busy ? '登録中…' : '登録してログイン'}</button>
            <button type="button" className="btn secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => setMode('choose')} disabled={busy}>戻る</button>
          </form>
        )}

        {msg ? <p className="meta" style={{ marginTop: 10 }}>{msg}</p> : null}
      </div>
    </div>
  );
}
