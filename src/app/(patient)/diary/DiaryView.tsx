'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DIARY_MOODS, type DiaryRow } from '@/lib/diaryCore';

export interface DiaryHandlers {
  onAdd: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
  onToggle: (id: string, isShared: boolean) => Promise<{ ok?: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ ok?: boolean; error?: string }>;
}

export function DiaryView({ entries, handlers, refreshOnChange = true }: { entries: DiaryRow[]; handlers: DiaryHandlers; refreshOnChange?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const [date, setDate] = useState(today);
  const [mood, setMood] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<DiaryRow[]>(entries);

  function refresh() { if (refreshOnChange) startTransition(() => router.refresh()); }

  async function submit() {
    if (!body.trim() && !title.trim()) { setMsg('内容を入力してください。'); return; }
    const fd = new FormData();
    fd.set('entry_date', date); fd.set('mood', mood); fd.set('title', title); fd.set('body', body);
    if (isShared) fd.set('is_shared', 'on');
    setBusy(true);
    const r = await handlers.onAdd(fd);
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    // 楽観的に先頭へ追加
    setList((prev) => [{ id: `tmp-${Date.now()}`, entry_date: date, mood: mood || null, title: title.trim() || null, body: body.trim(), is_shared: isShared }, ...prev]);
    setTitle(''); setBody(''); setMood(''); setIsShared(false); setMsg('✅ 保存しました。');
    refresh();
  }

  async function toggle(row: DiaryRow) {
    const next = !row.is_shared;
    setList((prev) => prev.map((e) => (e.id === row.id ? { ...e, is_shared: next } : e)));
    const r = await handlers.onToggle(row.id, next);
    if (r.error) { setMsg(r.error); setList((prev) => prev.map((e) => (e.id === row.id ? { ...e, is_shared: !next } : e))); return; }
    refresh();
  }

  async function del(row: DiaryRow) {
    if (!confirm('この日記を削除しますか？')) return;
    setList((prev) => prev.filter((e) => e.id !== row.id));
    const r = await handlers.onDelete(row.id);
    if (r.error) { setMsg(r.error); refresh(); return; }
    refresh();
  }

  return (
    <>
      <div className="card">
        <h2>📔 日記を書く</h2>
        <div className="field"><label>日付</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field">
          <label>きょうの気分</label>
          <div className="chips">
            {DIARY_MOODS.map((m) => (
              <button type="button" key={m} className={`chip${mood === m ? ' on' : ''}`} onClick={() => setMood(mood === m ? '' : m)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="field"><label>タイトル（任意）</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：今日の体調メモ" /></div>
        <div className="field"><label>本文</label><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="思ったこと・体調・出来事など自由に" /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
          <span>この日記を先生に公開する</span>
        </label>
        {msg ? <p className={msg.startsWith('✅') ? 'meta' : 'error'}>{msg}</p> : null}
        <button className="btn" style={{ width: '100%' }} onClick={submit} disabled={busy}>{busy ? '保存中…' : '日記を保存'}</button>
      </div>

      <div className="card">
        <h2>これまでの日記</h2>
        {list.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((e) => (
              <div key={e.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>{e.entry_date}{e.mood ? `　${e.mood}` : ''}</strong>
                  <span className={`tag${e.is_shared ? '' : ''}`} style={{ background: e.is_shared ? 'var(--accent-soft)' : 'var(--line)' }}>{e.is_shared ? '公開中' : '非公開'}</span>
                </div>
                {e.title ? <div style={{ fontWeight: 700, marginTop: 4 }}>{e.title}</div> : null}
                {e.body ? <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{e.body}</div> : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggle(e)}>{e.is_shared ? '非公開にする' : '先生に公開する'}</button>
                  <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => del(e)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="empty">まだ日記はありません</div>}
      </div>
    </>
  );
}
