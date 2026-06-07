'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { addLocation, deleteLocation, type ApptState } from '../actions';

function AddBtn() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '追加中…' : '＋ 追加'}</button>;
}

export function LocationPanel({ locations }: { locations: string[] }) {
  const [state, formAction] = useFormState<ApptState, FormData>(addLocation, {});
  const [delName, setDelName] = useState<string | null>(null);
  const [, startTr] = useTransition();
  const router = useRouter();

  function confirmDelete() {
    if (delName === null) return;
    const name = delName;
    setDelName(null);
    startTr(async () => {
      const fd = new FormData();
      fd.set('name', name);
      await deleteLocation(fd);
      router.refresh();
    });
  }

  return (
    <div className="card">
      <h2>施術場所</h2>
      <p className="meta">予約作成時に候補として選べる施術場所を登録します。Googleカレンダーの「場所」にも反映されます。</p>

      {/* 追加 */}
      <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label htmlFor="name">場所名</label>
          <input id="name" name="name" required placeholder="例: 院内 / オンライン / ○○出張先" />
        </div>
        <AddBtn />
      </form>
      {state?.error ? <p className="error">{state.error}</p> : null}

      {/* 一覧（削除） */}
      <div style={{ marginTop: 12 }}>
        {locations.length ? locations.map((l) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)' }}>
            <span>{l}</span>
            <button type="button" className="btn secondary" style={{ padding: '2px 8px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => setDelName(l)}>削除</button>
          </div>
        )) : <div className="empty" style={{ padding: 8 }}>まだありません。</div>}
      </div>

      {delName !== null ? (
        <div className="modal-overlay" onClick={() => setDelName(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>場所の削除</h2>
            <p className="meta">「{delName}」を候補から削除しますか？</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setDelName(null)}>キャンセル</button>
              <button className="btn" style={{ background: 'var(--danger)' }} onClick={confirmDelete}>削除する</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
