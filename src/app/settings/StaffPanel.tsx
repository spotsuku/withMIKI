'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createStaff, type StaffRow, type StaffState } from './staff-actions';

const ROLE_LABEL: Record<string, string> = { owner: 'オーナー', practitioner: '施術者', staff: 'スタッフ' };

function AddBtn() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '追加中…' : 'スタッフを追加'}</button>;
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }}
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? 'コピー済' : 'コピー'}
    </button>
  );
}

export function StaffPanel({ staff }: { staff: StaffRow[] }) {
  const [state, formAction] = useFormState<StaffState, FormData>(createStaff, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <h2>スタッフ（管理者）</h2>

      {/* 一覧 */}
      <ul className="patient-list" style={{ marginBottom: 12 }}>
        {staff.map((s) => (
          <li key={s.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', gap: 8 }}>
              <span>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <br />
                <span className="meta">{s.email}</span>
              </span>
              <span className="tag">{ROLE_LABEL[s.role] ?? s.role}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* 追加 */}
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>＋ スタッフを追加</button>
      ) : (
        <form action={formAction} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="field"><label htmlFor="s_name">名前 *</label><input id="s_name" name="name" required placeholder="例: 三木 花子" /></div>
          <div className="field"><label htmlFor="s_email">メールアドレス *</label><input id="s_email" name="email" type="email" required placeholder="staff@example.com" /></div>
          <div className="field">
            <label htmlFor="s_role">権限</label>
            <select id="s_role" name="role" defaultValue="practitioner">
              <option value="owner">オーナー</option>
              <option value="practitioner">施術者</option>
              <option value="staff">スタッフ</option>
            </select>
          </div>
          {state?.error ? <p className="error">{state.error}</p> : null}
          <div style={{ display: 'flex', gap: 10 }}>
            <AddBtn />
            <button type="button" className="btn secondary" onClick={() => setOpen(false)}>閉じる</button>
          </div>
        </form>
      )}

      {/* 発行結果 */}
      {state?.ok && state.password ? (
        <div className="card" style={{ marginTop: 12, background: 'var(--accent-soft)' }}>
          <p className="meta" style={{ marginTop: 0 }}>ログインアカウントを発行しました。本人へお伝えください（初回ログイン後にパスワード変更を推奨）。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 6, alignItems: 'center' }}>
            <span className="meta">メール</span><code style={{ wordBreak: 'break-all' }}>{state.email}</code><Copy text={state.email ?? ''} />
            <span className="meta">初期PW</span><code>{state.password}</code><Copy text={state.password} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
