'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveIntake, type KarteFormState } from './actions';
import { CHECK_ITEMS } from '@/lib/constants';

export interface IntakeInitial {
  chief?: string | null;
  onset?: string | null;
  current?: string | null;
  history?: string | null;
  sleep?: string | null;
  appetite?: string | null;
  meds?: string | null;
  note?: string | null;
  checks?: Record<string, string> | null;
}

const CHECK_OPTIONS = ['', 'はい', 'いいえ', '不明'];
type Field = 'chief' | 'onset' | 'current' | 'history' | 'sleep' | 'appetite' | 'meds' | 'note';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : '保存する'}
    </button>
  );
}

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result);
      resolve({ data: res.slice(res.indexOf(',') + 1), mediaType: file.type || 'image/jpeg' });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function IntakeForm({
  patientId,
  patientName,
  initial,
}: {
  patientId: string;
  patientName: string;
  initial?: IntakeInitial | null;
}) {
  const [state, formAction] = useFormState<KarteFormState, FormData>(saveIntake, {});
  const i = initial ?? {};
  const [vals, setVals] = useState<Record<Field, string>>({
    chief: i.chief ?? '', onset: i.onset ?? '', current: i.current ?? '', history: i.history ?? '',
    sleep: i.sleep ?? '', appetite: i.appetite ?? '', meds: i.meds ?? '', note: i.note ?? '',
  });
  const [ocr, setOcr] = useState<{ loading: boolean; msg?: string; error?: string }>({ loading: false });

  const set = (k: Field, v: string) => setVals((p) => ({ ...p, [k]: v }));

  async function onScan(file: File | undefined) {
    if (!file) return;
    setOcr({ loading: true });
    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/ai/intake-scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, mediaType, patientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '読み取りに失敗しました');
      const got = (json.intake ?? {}) as Partial<Record<Field, string>>;
      setVals((prev) => {
        const next = { ...prev };
        (Object.keys(next) as Field[]).forEach((k) => { if (got[k]) next[k] = got[k] as string; });
        return next;
      });
      setOcr({ loading: false, msg: '読み取りました。内容を確認して保存してください。' });
    } catch (e) {
      setOcr({ loading: false, error: (e as Error).message });
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      <div className="card">
        <h2>問診・基本情報の編集　<span className="meta">{patientName}</span></h2>

        <div className="field">
          <label>問診票の画像から読み取り（AI・任意）</label>
          <input type="file" accept="image/*" capture="environment" disabled={ocr.loading} onChange={(e) => onScan(e.target.files?.[0])} />
          {ocr.loading ? <p className="meta">読み取り中…</p> : null}
          {ocr.msg ? <p className="meta">✅ {ocr.msg}</p> : null}
          {ocr.error ? <p className="error">{ocr.error}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="chief">主訴</label>
          <textarea id="chief" name="chief" rows={2} value={vals.chief} onChange={(e) => set('chief', e.target.value)} />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="onset">発症時期</label>
            <input id="onset" name="onset" value={vals.onset} onChange={(e) => set('onset', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sleep">睡眠</label>
            <input id="sleep" name="sleep" value={vals.sleep} onChange={(e) => set('sleep', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="current">現病歴</label>
          <textarea id="current" name="current" rows={2} value={vals.current} onChange={(e) => set('current', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="history">既往歴</label>
          <textarea id="history" name="history" rows={2} value={vals.history} onChange={(e) => set('history', e.target.value)} />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="appetite">食欲</label>
            <input id="appetite" name="appetite" value={vals.appetite} onChange={(e) => set('appetite', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="meds">服薬</label>
            <input id="meds" name="meds" value={vals.meds} onChange={(e) => set('meds', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">禁忌・備考</label>
          <textarea id="note" name="note" rows={2} value={vals.note} onChange={(e) => set('note', e.target.value)} />
        </div>

        <h2 style={{ marginTop: 18 }}>問診チェック</h2>
        {CHECK_ITEMS.map((item, idx) => (
          <div className="field" key={idx}>
            <label htmlFor={`check_${idx}`}>{item}</label>
            <select id={`check_${idx}`} name={`check_${idx}`} defaultValue={i.checks?.[String(idx)] ?? ''}>
              {CHECK_OPTIONS.map((o) => (
                <option key={o} value={o}>{o === '' ? '—' : o}</option>
              ))}
            </select>
          </div>
        ))}

        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <SubmitButton />
          <Link className="btn secondary" href={`/patients/${patientId}`}>
            キャンセル
          </Link>
        </div>
      </div>
    </form>
  );
}
