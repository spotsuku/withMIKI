'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveLab, type LabFormState } from './actions';
import type { LabCategoryGroup } from '@/lib/types';

export interface LabInitial {
  id?: string;
  taken_date?: string | null;
  comment?: string | null;
  values?: Record<string, string>;
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : isEdit ? '更新する' : '保存する'}
    </button>
  );
}

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const comma = res.indexOf(',');
      resolve({ data: res.slice(comma + 1), mediaType: file.type || 'image/jpeg' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function LabForm({
  patientId,
  patientName,
  groups,
  initial,
}: {
  patientId: string;
  patientName: string;
  groups: LabCategoryGroup[];
  initial?: LabInitial;
}) {
  const [state, formAction] = useFormState<LabFormState, FormData>(saveLab, {});
  const isEdit = Boolean(initial?.id);
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [ocrState, setOcrState] = useState<{ loading: boolean; msg?: string; error?: string }>({
    loading: false,
  });

  function setVal(code: string, v: string) {
    setValues((prev) => ({ ...prev, [code]: v }));
  }

  async function onOcr(file: File | undefined) {
    if (!file) return;
    setOcrState({ loading: true });
    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/ai/lab-ocr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, mediaType, patientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '読み取りに失敗しました');
      const got = (json.values ?? {}) as Record<string, number>;
      const n = Object.keys(got).length;
      setValues((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(got)) next[k] = String(v);
        return next;
      });
      setOcrState({ loading: false, msg: `${n} 項目を読み取りました。内容を確認して保存してください。` });
    } catch (e) {
      setOcrState({ loading: false, error: (e as Error).message });
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      {initial?.id ? <input type="hidden" name="labId" value={initial.id} /> : null}

      <div className="card">
        <h2>{isEdit ? '採血の編集' : '採血の入力（手入力）'}　<span className="meta">{patientName}</span></h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="taken_date">採血日 *</label>
            <input
              id="taken_date"
              name="taken_date"
              type="date"
              required
              defaultValue={initial?.taken_date ?? new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="comment">コメント</label>
          <textarea id="comment" name="comment" rows={2} defaultValue={initial?.comment ?? ''} />
        </div>

        {/* AI OCR */}
        <div className="field">
          <label>採血結果の画像から読み取り（AI・任意）</label>
          <input
            type="file"
            accept="image/*" capture="environment"
            disabled={ocrState.loading}
            onChange={(e) => onOcr(e.target.files?.[0])}
          />
          {ocrState.loading ? <p className="meta">読み取り中…</p> : null}
          {ocrState.msg ? <p className="meta">✅ {ocrState.msg}</p> : null}
          {ocrState.error ? <p className="error">{ocrState.error}</p> : null}
        </div>
      </div>

      {groups.map((g) => (
        <div className="card" key={g.category}>
          <h2>{g.category}</h2>
          <div className="grid cols-2">
            {g.items.map((it) => {
              const ref =
                it.ref_low !== null || it.ref_high !== null
                  ? `基準 ${it.ref_low ?? ''}〜${it.ref_high ?? ''}`
                  : '';
              return (
                <div className="field" key={it.code}>
                  <label htmlFor={`lab_${it.code}`}>
                    {it.name}
                    {it.unit ? <span className="meta">（{it.unit}）</span> : null}
                  </label>
                  <input
                    id={`lab_${it.code}`}
                    name={`lab_${it.code}`}
                    type="text"
                    inputMode="decimal"
                    placeholder={ref}
                    value={values[it.code] ?? ''}
                    onChange={(e) => setVal(it.code, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="card">
        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <SubmitButton isEdit={isEdit} />
          <Link className="btn secondary" href={`/patients/${patientId}`}>
            キャンセル
          </Link>
        </div>
      </div>
    </form>
  );
}
