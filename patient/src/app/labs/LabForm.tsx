'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveLab, type LabState } from './actions';

export interface CatItem { code: string; name: string; unit: string | null; category: string | null }

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const res = String(r.result); resolve({ data: res.slice(res.indexOf(',') + 1), mediaType: file.type || 'image/jpeg' }); };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : '保存する'}</button>;
}

export function LabForm({ groups }: { groups: { category: string; items: CatItem[] }[] }) {
  const [state, formAction] = useFormState<LabState, FormData>(saveLab, {});
  const [values, setValues] = useState<Record<string, string>>({});
  const [ocr, setOcr] = useState<{ loading: boolean; msg?: string; error?: string }>({ loading: false });

  async function onOcr(file: File | undefined) {
    if (!file) return;
    setOcr({ loading: true });
    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/ai/lab-ocr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageBase64: data, mediaType }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '読み取りに失敗しました');
      const got = (json.values ?? {}) as Record<string, number>;
      setValues((prev) => { const n = { ...prev }; for (const [k, v] of Object.entries(got)) n[k] = String(v); return n; });
      setOcr({ loading: false, msg: `${Object.keys(got).length} 項目を読み取りました。` });
    } catch (e) { setOcr({ loading: false, error: (e as Error).message }); }
  }

  return (
    <form action={formAction}>
      <div className="card">
        <h2>採血の入力</h2>
        <div className="field">
          <label htmlFor="taken_date">採血日 *</label>
          <input id="taken_date" name="taken_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="field">
          <label>採血結果の画像から読み取り（AI・任意）</label>
          <input type="file" accept="image/*" capture="environment" disabled={ocr.loading} onChange={(e) => onOcr(e.target.files?.[0])} />
          {ocr.loading ? <p className="meta">読み取り中…</p> : null}
          {ocr.msg ? <p className="meta">✅ {ocr.msg}</p> : null}
          {ocr.error ? <p className="error">{ocr.error}</p> : null}
        </div>
        <div className="field"><label htmlFor="comment">コメント</label><textarea id="comment" name="comment" rows={2} /></div>
      </div>

      {groups.map((g) => (
        <details className="card" key={g.category}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{g.category}</summary>
          <div className="grid cols-2" style={{ marginTop: 10 }}>
            {g.items.map((it) => (
              <div className="field" key={it.code}>
                <label>{it.name}{it.unit ? <span className="meta">（{it.unit}）</span> : null}</label>
                <input name={`lab_${it.code}`} type="text" inputMode="decimal"
                  value={values[it.code] ?? ''} onChange={(e) => setValues({ ...values, [it.code]: e.target.value })} />
              </div>
            ))}
          </div>
        </details>
      ))}

      <div className="card">
        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <Save />
          <Link className="btn secondary" href="/today">キャンセル</Link>
        </div>
      </div>
    </form>
  );
}
