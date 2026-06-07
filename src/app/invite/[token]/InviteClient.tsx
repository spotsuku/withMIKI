'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function InviteClient({ token, patientName }: { token: string; patientName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'password'>('choose');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
            <a className="btn" style={{ width: '100%', background: '#06c755', marginBottom: 10, textAlign: 'center', display: 'block' }} href={`/api/auth/line/start?mode=invite&token=${encodeURIComponent(token)}`}>
              LINEで登録・ログイン
            </a>
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
