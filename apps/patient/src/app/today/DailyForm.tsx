'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveDaily, type DailyState } from './actions';

export interface DailyInitial {
  record_date: string;
  weight?: number | null;
  body_temp?: number | null;
  sleep_hours?: number | null;
  memo?: string | null;
  bbt?: number | null;
  menstrual?: string | null;
  flow?: string | null;
  pain?: number | null;
}

const MENSTRUAL = [
  { value: '', label: '—' },
  { value: 'none', label: 'なし' },
  { value: 'period', label: '月経中' },
  { value: 'spotting', label: '少量出血' },
];
const FLOW = [
  { value: '', label: '—' },
  { value: 'light', label: '少' },
  { value: 'medium', label: '中' },
  { value: 'heavy', label: '多' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? '保存中…' : '保存する'}
    </button>
  );
}

export function DailyForm({ initial }: { initial: DailyInitial }) {
  const [state, formAction] = useFormState<DailyState, FormData>(saveDaily, {});
  const i = initial;

  return (
    <form action={formAction}>
      <input type="hidden" name="record_date" value={i.record_date} />

      <div className="card">
        <h2>基礎体温・月経</h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="bbt">基礎体温（℃）</label>
            <input id="bbt" name="bbt" type="number" step="0.01" inputMode="decimal" defaultValue={i.bbt ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="menstrual">月経</label>
            <select id="menstrual" name="menstrual" defaultValue={i.menstrual ?? ''}>
              {MENSTRUAL.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="flow">経血量</label>
            <select id="flow" name="flow" defaultValue={i.flow ?? ''}>
              {FLOW.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pain">痛み（0〜5）</label>
            <input id="pain" name="pain" type="number" min={0} max={5} inputMode="numeric" defaultValue={i.pain ?? ''} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>からだ</h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="weight">体重（kg）</label>
            <input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" defaultValue={i.weight ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="body_temp">体温（℃）</label>
            <input id="body_temp" name="body_temp" type="number" step="0.1" inputMode="decimal" defaultValue={i.body_temp ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="sleep_hours">睡眠（時間）</label>
            <input id="sleep_hours" name="sleep_hours" type="number" step="0.5" inputMode="decimal" defaultValue={i.sleep_hours ?? ''} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="memo">メモ・体調</label>
          <textarea id="memo" name="memo" rows={3} defaultValue={i.memo ?? ''} />
        </div>
      </div>

      <div className="card">
        {state?.ok ? <p className="meta">✅ 保存しました。</p> : null}
        {state?.error ? <p className="error">{state.error}</p> : null}
        <SubmitButton />
      </div>
    </form>
  );
}
