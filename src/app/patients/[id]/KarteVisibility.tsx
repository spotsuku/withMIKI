'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { KARTE_SECTIONS } from '@/lib/karteSections';
import { saveKarteVisibility, type VisState } from './visibilityActions';

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : '公開設定を保存'}</button>;
}

export function KarteVisibility({ patientId, visible }: { patientId: string; visible: Record<string, boolean> }) {
  const [state, formAction] = useFormState<VisState, FormData>(saveKarteVisibility, {});
  return (
    <div className="card">
      <h2>患者への公開設定</h2>
      <p className="meta">この基本カルテのうち、<strong>公開</strong>にした部分だけが患者のカルテ画面に表示されます（既定はすべて公開）。</p>
      <form action={formAction}>
        <input type="hidden" name="patientId" value={patientId} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {KARTE_SECTIONS.map((s) => (
            <label key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid var(--line)' }}>
              <span>{s.label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" name={`vis_${s.key}`} defaultChecked={visible[s.key] ?? true} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                <span className="meta">公開</span>
              </span>
            </label>
          ))}
        </div>
        {state?.ok ? <p className="meta">✅ 保存しました。</p> : null}
        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ marginTop: 12 }}><Save /></div>
      </form>
    </div>
  );
}
