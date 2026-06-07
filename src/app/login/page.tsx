'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { login, devLogin } from './actions';

const initialState: { error?: string } = {};

// 開発用ログインボタンの表示フラグ（ビルド時に埋め込み）。
// 実際の認可はサーバー側の DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD で制御する。
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

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI カルテ ログイン</h2>
        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">メールアドレス</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <SubmitButton />
          {state?.error ? <p className="error">{state.error}</p> : null}
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span className="meta">または</span>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        <a className="btn" href="/api/auth/line/start?mode=login" style={{ width: '100%', background: '#06c755', textAlign: 'center', display: 'block' }}>
          LINEでログイン
        </a>

        {DEV_LOGIN_VISIBLE ? (
          <form action={devAction} style={{ marginTop: 12, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
            <DevButton />
            {devState?.error ? <p className="error">{devState.error}</p> : null}
            <p className="meta" style={{ marginTop: 6 }}>
              開発用の固定アカウントへ自動ログインします（本番では無効）。
            </p>
          </form>
        ) : null}
      </div>
      <p className="meta">
        患者さんは先生から届く「招待URL」からアカウントを作成します。
        先生アカウントは Supabase の Authentication で作成し、app_user にひも付けてください
        （docs/setup/supabase-setup.md §4）。LINEでログインするには、先生は「設定」から事前にLINE連携が必要です。
      </p>
    </div>
  );
}
