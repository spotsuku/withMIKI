'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
  const [showCreate, setShowCreate] = useState(false);
  const [delIdx, setDelIdx] = useState<number | null>(null);
  const [, startTr] = useTransition();
  const router = useRouter();

  function confirmDelete() {
    if (delIdx === null) return;
    const idx = delIdx;
    setDelIdx(null);
    startTr(async () => {
      const fd = new FormData();
      fd.set('idx', String(idx));
      await deleteTemplate(fd);
      router.refresh();
    });
  }
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
            <button type="button" className="btn secondary" style={{ padding: '2px 8px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => setDelIdx(i)}>削除</button>
          </div>
        ))}
      </div>

      {/* 新規テンプレ作成（ボタンで開く） */}
      <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {!showCreate ? (
          <button className="btn" onClick={() => setShowCreate(true)}>＋ テンプレを新規作成</button>
        ) : (
          <form action={saveAction}>
            <h2 style={{ marginTop: 0 }}>テンプレを新規作成</h2>
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
            <div style={{ display: 'flex', gap: 10 }}>
              <SaveBtn />
              <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>キャンセル</button>
            </div>
          </form>
        )}
      </div>

      {delIdx !== null ? (
        <div className="modal-overlay" onClick={() => setDelIdx(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>テンプレの削除</h2>
            <p className="meta">「{templates[delIdx]?.name}」を削除しますか？</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setDelIdx(null)}>キャンセル</button>
              <button className="btn" style={{ background: 'var(--danger)' }} onClick={confirmDelete}>削除する</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
