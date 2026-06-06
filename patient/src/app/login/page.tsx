'use client';

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
  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI デイリーレコード</h2>
        <p className="meta">先生から伝えられたメールアドレス・パスワードでログインしてください。</p>
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
        </form>
      </div>
    </div>
  );
}
