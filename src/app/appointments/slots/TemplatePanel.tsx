'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { applyTemplate, saveTemplate, deleteTemplate, type ApptState } from '../actions';
import type { SlotTemplate } from '@/lib/slotTemplates';

const WD = [['1', '月'], ['2', '火'], ['3', '水'], ['4', '木'], ['5', '金'], ['6', '土'], ['0', '日']];
const WDLABEL: Record<number, string> = { 0: '日', 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土' };

function ApplyBtn() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '適用中…' : 'この期間に適用'}</button>;
}
function SaveBtn() {
  const { pending } = useFormStatus();
  return <button className="btn secondary" type="submit" disabled={pending}>{pending ? '保存中…' : 'テンプレを保存'}</button>;
}

export function TemplatePanel({ templates }: { templates: SlotTemplate[] }) {
  const [applyState, applyAction] = useFormState<ApptState, FormData>(applyTemplate, {});
  const [saveState, saveAction] = useFormState<ApptState, FormData>(saveTemplate, {});
  const today = new Date().toISOString().slice(0, 10);
  const plus4w = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="card">
      <h2>空き枠テンプレート</h2>

      {/* 適用 */}
      <form action={applyAction}>
        <div className="field">
          <label htmlFor="idx">テンプレ</label>
          <select id="idx" name="idx" defaultValue="0">
            {templates.map((t, i) => (
              <option key={i} value={i}>
                {t.name}（{t.weekdays.map((w) => WDLABEL[w]).join('')} {t.start}-{t.end} {t.interval}分）
              </option>
            ))}
          </select>
        </div>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="date_from">開始日</label><input id="date_from" name="date_from" type="date" defaultValue={today} required /></div>
          <div className="field"><label htmlFor="date_to">終了日</label><input id="date_to" name="date_to" type="date" defaultValue={plus4w} required /></div>
        </div>
        {applyState?.error ? <p className="error">{applyState.error}</p> : null}
        <ApplyBtn />
      </form>

      {/* テンプレ一覧（削除） */}
      <div style={{ marginTop: 12 }}>
        {templates.map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: '1px solid var(--line)' }}>
            <span className="meta">{t.name}（{t.weekdays.map((w) => WDLABEL[w]).join('')} {t.start}-{t.end} {t.interval}分）</span>
            <form action={deleteTemplate}><input type="hidden" name="idx" value={i} />
              <button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}>削除</button>
            </form>
          </div>
        ))}
      </div>

      {/* 新規テンプレ保存 */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>テンプレを新規作成</summary>
        <form action={saveAction} style={{ marginTop: 8 }}>
          <div className="field"><label htmlFor="name">名称 *</label><input id="name" name="name" required placeholder="例: 平日夜間" /></div>
          <div className="grid cols-2">
            <div className="field"><label htmlFor="t_start">開始</label><input id="t_start" name="start" type="time" defaultValue="18:00" required /></div>
            <div className="field"><label htmlFor="t_end">終了</label><input id="t_end" name="end" type="time" defaultValue="21:00" required /></div>
            <div className="field"><label htmlFor="t_int">1枠</label><select id="t_int" name="interval" defaultValue="60">{[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}分</option>)}</select></div>
          </div>
          <div className="field">
            <label>曜日</label>
            <div className="wd-list">
              {WD.map(([v, l]) => (
                <label key={v}>
                  <input type="checkbox" name="wd" value={v} defaultChecked={v !== '0'} />{l}
                </label>
              ))}
            </div>
          </div>
          {saveState?.error ? <p className="error">{saveState.error}</p> : null}
          <SaveBtn />
        </form>
      </details>
    </div>
  );
}
