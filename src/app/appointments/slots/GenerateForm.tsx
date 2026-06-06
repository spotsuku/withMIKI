'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { generateSlots, type ApptState } from '../actions';

const WD = [['1', '月'], ['2', '火'], ['3', '水'], ['4', '木'], ['5', '金'], ['6', '土'], ['0', '日']];

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '生成中…' : '一括生成'}</button>;
}

export function GenerateForm() {
  const [state, formAction] = useFormState<ApptState, FormData>(generateSlots, {});
  return (
    <form action={formAction}>
      <div className="card">
        <h2>営業時間から空き枠を一括生成</h2>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="date_from">開始日 *</label><input id="date_from" name="date_from" type="date" required /></div>
          <div className="field"><label htmlFor="date_to">終了日 *</label><input id="date_to" name="date_to" type="date" required /></div>
          <div className="field"><label htmlFor="start">開始時刻 *</label><input id="start" name="start" type="time" required defaultValue="10:00" /></div>
          <div className="field"><label htmlFor="end">終了時刻 *</label><input id="end" name="end" type="time" required defaultValue="18:00" /></div>
          <div className="field">
            <label htmlFor="interval">1枠の長さ</label>
            <select id="interval" name="interval" defaultValue="60">
              {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}分</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>対象曜日</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {WD.map(([v, l]) => (
              <label key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink)' }}>
                <input type="checkbox" name="wd" value={v} defaultChecked={v !== '0'} /> {l}
              </label>
            ))}
          </div>
        </div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <Save />
        <p className="meta" style={{ marginTop: 6 }}>※ 生成した枠は Google カレンダー連携済みなら自動で同期されます。</p>
      </div>
    </form>
  );
}
