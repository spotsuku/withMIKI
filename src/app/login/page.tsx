'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { login, devLogin } from './actions';

const initialState: { error?: string } = {};

// 開発用ログインボタンの表示フラグ（ビルド時に埋め込み）。サーバー側の DEV_LOGIN_* が無ければ押しても拒否。
const DEV_LOGIN_VISIBLE = process.env.NEXT_PUBLIC_DEV_LOGIN === '1';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'ログイン中…' : 'ログイン'}
    </button>
  );
}

function DevButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn secondary" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? '…' : '🛠 開発用: ログインをスキップ'}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState);
  const [devState, devAction] = useFormState(devLogin, initialState);
  const [showAdmin, setShowAdmin] = useState(false);

  function startLineLogin() {
    try { sessionStorage.setItem('liff_mode', 'login'); sessionStorage.removeItem('liff_token'); } catch { /* noop */ }
    window.location.href = '/liff';
  }

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI ログイン</h2>

        {/* 患者さんは LINE ログイン */}
        <button className="btn" onClick={startLineLogin} style={{ width: '100%', background: '#06c755' }}>
          LINEでログイン
        </button>
        <p className="meta" style={{ marginTop: 10 }}>
          患者さんは <strong>LINEでログイン</strong> してください。
          初めての方は、先生から届く「招待URL」から登録できます。
        </p>

        {/* 管理者（先生）ログイン：小さな導線で常設 */}
        <div style={{ borderTop: '1px dashed var(--line)', marginTop: 16, paddingTop: 12 }}>
          {!showAdmin ? (
            <button
              onClick={() => setShowAdmin(true)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', textDecoration: 'underline', fontSize: 13, cursor: 'pointer', padding: 4 }}
            >
              管理者（先生）の方はこちら
            </button>
          ) : (
            <>
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

              {DEV_LOGIN_VISIBLE ? (
                <form action={devAction} style={{ marginTop: 12, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
                  <DevButton />
                  {devState?.error ? <p className="error">{devState.error}</p> : null}
                </form>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
