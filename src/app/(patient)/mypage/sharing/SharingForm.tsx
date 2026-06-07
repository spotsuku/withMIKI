'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveSharing, type ShareState } from './actions';
import { SHARE_SECTIONS } from '@/lib/sections';

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : '共有設定を保存'}</button>;
}

export function SharingForm({ shared }: { shared: Record<string, boolean> }) {
  const [state, formAction] = useFormState<ShareState, FormData>(saveSharing, {});
  return (
    <form action={formAction}>
      <div className="card">
        <h2>施術者への共有設定</h2>
        <p className="meta">公開にした項目だけ、担当の先生のカルテに表示されます。いつでも変更できます。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {SHARE_SECTIONS.map((s) => {
            const on = shared[s.key] ?? true;
            return (
              <label key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>
                <span>{s.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" name={`share_${s.key}`} defaultChecked={on} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                  <span className="meta">公開</span>
                </span>
              </label>
            );
          })}
        </div>
        {state?.ok ? <p className="meta">✅ 保存しました。</p> : null}
        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ marginTop: 12 }}><Save /></div>
      </div>
    </form>
  );
}
