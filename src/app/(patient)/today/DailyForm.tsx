'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveDaily, type DailyState } from './actions';
import { Chips } from '@/components/Chips';
import { GYNECO_CHIPS, GYNECO_EXTRA_CHIPS, SELFCARES, MEDS } from '@/lib/gyneco';

export interface DailyInitial {
  record_date: string;
  weight?: number | null;
  body_fat?: number | null;
  body_temp?: number | null;
  sleep_hours?: number | null;
  water?: number | null;
  memo?: string | null;
  bbt?: number | null;
  pain?: number | null;
  /** gyneco_daily の col 値（single=string, multi=string[]） */
  gyneco?: Record<string, unknown>;
  /** daily_record.payload（追加チップ） */
  payload?: Record<string, unknown>;
  /** 実施済みセルフケア code 配列 */
  selfcare?: string[];
  /** 服用した薬名 配列 */
  meds?: string[];
}

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
  const g = i.gyneco ?? {};
  const pl = i.payload ?? {};

  return (
    <form action={formAction}>
      <input type="hidden" name="record_date" value={i.record_date} />

      <div className="card">
        <h2>基礎体温・痛み</h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="bbt">基礎体温（℃）</label>
            <input id="bbt" name="bbt" type="number" step="0.01" inputMode="decimal" defaultValue={i.bbt ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="pain">痛み（0〜5）</label>
            <input id="pain" name="pain" type="number" min={0} max={5} inputMode="numeric" defaultValue={i.pain ?? ''} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>月経・婦人科</h2>
        {GYNECO_CHIPS.map((group) => (
          <Chips
            key={group.key}
            group={group}
            initialSingle={group.type === 'single' ? (g[group.col as string] as string) : undefined}
            initialMulti={group.type === 'multi' ? (g[group.col as string] as string[]) : undefined}
          />
        ))}
      </div>

      <div className="card">
        <h2>からだ・生活</h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="weight">体重（kg）</label>
            <input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" defaultValue={i.weight ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="body_fat">体脂肪（%）</label>
            <input id="body_fat" name="body_fat" type="number" step="0.1" inputMode="decimal" defaultValue={i.body_fat ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="body_temp">体温（℃）</label>
            <input id="body_temp" name="body_temp" type="number" step="0.1" inputMode="decimal" defaultValue={i.body_temp ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="sleep_hours">睡眠（時間）</label>
            <input id="sleep_hours" name="sleep_hours" type="number" step="0.5" inputMode="decimal" defaultValue={i.sleep_hours ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="water">水分（L）</label>
            <input id="water" name="water" type="number" step="0.1" inputMode="decimal" defaultValue={i.water ?? ''} />
          </div>
        </div>
        {GYNECO_EXTRA_CHIPS.map((group) => (
          <Chips
            key={group.key}
            group={group}
            initialSingle={group.type === 'single' ? (pl[group.key] as string) : undefined}
            initialMulti={group.type === 'multi' ? (pl[group.key] as string[]) : undefined}
          />
        ))}
        <div className="field">
          <label htmlFor="memo">メモ・体調</label>
          <textarea id="memo" name="memo" rows={3} defaultValue={i.memo ?? ''} />
        </div>
      </div>

      <div className="card">
        <h2>セルフケア</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SELFCARES.map((sc) => (
            <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
              <input type="checkbox" name={`sc_${sc.id}`} defaultChecked={i.selfcare?.includes(sc.id)} />
              <span>{sc.icon} {sc.name}<span className="meta">（{sc.sub}）</span></span>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>服薬・サプリ</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
          {MEDS.map((m) => (
            <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink)' }}>
              <input type="checkbox" name={`med_${m}`} defaultChecked={i.meds?.includes(m)} /> {m}
            </label>
          ))}
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
