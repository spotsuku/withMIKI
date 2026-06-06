'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { savePatient, type PatientFormState } from './actions';
import { SEX_OPTIONS } from '@/lib/constants';

type ScanField = 'name' | 'kana' | 'dob' | 'sex' | 'blood_type' | 'tel' | 'email' | 'address' | 'job';

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const res = String(r.result); resolve({ data: res.slice(res.indexOf(',') + 1), mediaType: file.type || 'image/jpeg' }); };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export interface PatientInitial {
  id?: string;
  name?: string | null;
  kana?: string | null;
  code?: string | null;
  dob?: string | null;
  sex?: string | null;
  blood_type?: string | null;
  tel?: string | null;
  email?: string | null;
  address?: string | null;
  job?: string | null;
  first_visit_date?: string | null;
  hospital?: string | null;
  avatar?: string | null;
  program?: string | null; // care_program.code: gyneco / athlete / master
}

const PROGRAMS = [
  { value: 'gyneco', label: '婦人科' },
  { value: 'athlete', label: 'アスリート' },
  { value: 'master', label: '総合・一般' },
];

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : isEdit ? '更新する' : '登録する'}
    </button>
  );
}

export function PatientForm({ initial }: { initial?: PatientInitial }) {
  const [state, formAction] = useFormState<PatientFormState, FormData>(savePatient, {});
  const isEdit = Boolean(initial?.id);
  const backHref = initial?.id ? `/patients/${initial.id}` : '/patients';

  const [v, setV] = useState<Record<ScanField, string>>({
    name: initial?.name ?? '', kana: initial?.kana ?? '', dob: initial?.dob ?? '',
    sex: initial?.sex ?? '', blood_type: initial?.blood_type ?? '', tel: initial?.tel ?? '',
    email: initial?.email ?? '', address: initial?.address ?? '', job: initial?.job ?? '',
  });
  const set = (k: ScanField, val: string) => setV((p) => ({ ...p, [k]: val }));
  const [scan, setScan] = useState<{ loading: boolean; msg?: string; error?: string }>({ loading: false });

  async function onScan(file: File | undefined) {
    if (!file) return;
    setScan({ loading: true });
    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/ai/karte-scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageBase64: data, mediaType }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '読み取りに失敗しました');
      const pt = (json.patient ?? {}) as Partial<Record<ScanField, string>>;
      setV((prev) => { const n = { ...prev }; (Object.keys(n) as ScanField[]).forEach((k) => { if (pt[k]) n[k] = pt[k] as string; }); return n; });
      setScan({ loading: false, msg: '読み取りました。内容を確認して登録してください。' });
    } catch (e) { setScan({ loading: false, error: (e as Error).message }); }
  }

  return (
    <form action={formAction}>
      {initial?.id ? <input type="hidden" name="patientId" value={initial.id} /> : null}

      <div className="card">
        <h2>{isEdit ? '基本情報の編集' : '新規患者登録'}</h2>
        <div className="field">
          <label>📷 紙のカルテ・問診票を撮影して読み込み（AI・任意）</label>
          <input type="file" accept="image/*" capture="environment" disabled={scan.loading} onChange={(e) => onScan(e.target.files?.[0])} />
          {scan.loading ? <p className="meta">読み取り中…</p> : null}
          {scan.msg ? <p className="meta">✅ {scan.msg}</p> : null}
          {scan.error ? <p className="error">{scan.error}</p> : null}
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="name">氏名 *</label>
            <input id="name" name="name" required value={v.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="program">カルテ種別</label>
            <select id="program" name="program" defaultValue={initial?.program ?? 'gyneco'}>
              {PROGRAMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="kana">フリガナ</label>
            <input id="kana" name="kana" value={v.kana} onChange={(e) => set('kana', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="code">患者番号</label>
            <input id="code" name="code" defaultValue={initial?.code ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="dob">生年月日</label>
            <input id="dob" name="dob" type="date" value={v.dob} onChange={(e) => set('dob', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sex">性別</label>
            <select id="sex" name="sex" value={v.sex} onChange={(e) => set('sex', e.target.value)}>
              <option value="">選択しない</option>
              {SEX_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="blood_type">血液型</label>
            <input id="blood_type" name="blood_type" value={v.blood_type} onChange={(e) => set('blood_type', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tel">電話</label>
            <input id="tel" name="tel" value={v.tel} onChange={(e) => set('tel', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">メール</label>
            <input id="email" name="email" type="email" value={v.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="first_visit_date">初診日</label>
            <input
              id="first_visit_date"
              name="first_visit_date"
              type="date"
              defaultValue={initial?.first_visit_date ?? ''}
            />
          </div>
          <div className="field">
            <label htmlFor="job">職業</label>
            <input id="job" name="job" value={v.job} onChange={(e) => set('job', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="hospital">かかりつけ医療機関</label>
            <input id="hospital" name="hospital" defaultValue={initial?.hospital ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="avatar">アイコン（絵文字）</label>
            <input id="avatar" name="avatar" maxLength={4} defaultValue={initial?.avatar ?? ''} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="address">住所</label>
          <input id="address" name="address" value={v.address} onChange={(e) => set('address', e.target.value)} />
        </div>

        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <SubmitButton isEdit={isEdit} />
          <Link className="btn secondary" href={backHref}>
            キャンセル
          </Link>
        </div>
      </div>
    </form>
  );
}
