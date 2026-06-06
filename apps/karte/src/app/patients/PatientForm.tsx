'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { savePatient, type PatientFormState } from './actions';
import { SEX_OPTIONS } from '@/lib/constants';

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
}

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

  return (
    <form action={formAction}>
      {initial?.id ? <input type="hidden" name="patientId" value={initial.id} /> : null}

      <div className="card">
        <h2>{isEdit ? '基本情報の編集' : '新規患者登録'}</h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="name">氏名 *</label>
            <input id="name" name="name" required defaultValue={initial?.name ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="kana">フリガナ</label>
            <input id="kana" name="kana" defaultValue={initial?.kana ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="code">患者番号</label>
            <input id="code" name="code" defaultValue={initial?.code ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="dob">生年月日</label>
            <input id="dob" name="dob" type="date" defaultValue={initial?.dob ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="sex">性別</label>
            <select id="sex" name="sex" defaultValue={initial?.sex ?? ''}>
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
            <input id="blood_type" name="blood_type" defaultValue={initial?.blood_type ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="tel">電話</label>
            <input id="tel" name="tel" defaultValue={initial?.tel ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="email">メール</label>
            <input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} />
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
            <input id="job" name="job" defaultValue={initial?.job ?? ''} />
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
          <input id="address" name="address" defaultValue={initial?.address ?? ''} />
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
