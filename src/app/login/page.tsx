'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { login } from './actions';

const initialState: { error?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'ログイン中…' : 'ログイン'}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState);
  const [showAdmin, setShowAdmin] = useState(false);
  // 管理者ログインは専用URL（/login?admin=1）でのみ表示。患者用URLには出さない
  const [adminAllowed, setAdminAllowed] = useState(false);
  useEffect(() => {
    try { setAdminAllowed(new URLSearchParams(window.location.search).get('admin') === '1'); } catch { /* noop */ }
  }, []);

  function startLineLogin() {
    try { sessionStorage.setItem('liff_mode', 'login'); sessionStorage.removeItem('liff_token'); } catch { /* noop */ }
    window.location.href = '/liff';
  }

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI ログイン</h2>

        {/* 患者さんは LINE ログインのみ */}
        <button className="btn" onClick={startLineLogin} style={{ width: '100%', background: '#06c755' }}>
          LINEでログイン
        </button>
        <p className="meta" style={{ marginTop: 10 }}>
          患者さんは <strong>LINEでログイン</strong> してください。
          初めての方は、先生から届く「招待URL」から登録できます。
        </p>

        {/* 管理者（先生）のみ：メール・パスワード（専用URL /login?admin=1 でのみ表示） */}
        {adminAllowed ? (
          <div style={{ borderTop: '1px dashed var(--line)', marginTop: 16, paddingTop: 12 }}>
            {!showAdmin ? (
              <button className="btn secondary" style={{ width: '100%' }} onClick={() => setShowAdmin(true)}>
                管理者の方（メールでログイン）
              </button>
            ) : (
              <form action={formAction}>
                <div className="field">
                  <label htmlFor="email">メールアドレス</label>
                  <input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="field">
                  <label htmlFor="password">パスワード</label>
                  <input id="password" name="password" type="password" autoComplete="current-password" required />
                </div>
                <SubmitButton />
                {state?.error ? <p className="error">{state.error}</p> : null}
                <p className="meta" style={{ marginTop: 8 }}>※ メール・パスワードでのログインは管理者（先生）専用です。</p>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
