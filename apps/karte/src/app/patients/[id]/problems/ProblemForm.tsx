'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { saveProblem, type ProblemFormState } from './actions';
import { PROBLEM_STATUS } from '@/lib/constants';

export interface ProblemInitial {
  id?: string;
  title?: string | null;
  category?: string | null;
  diagnosis?: string | null;
  onset?: string | null;
  detail?: string | null;
  status?: string | null;
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : isEdit ? '更新する' : '作成する'}
    </button>
  );
}

export function ProblemForm({
  patientId,
  initial,
}: {
  patientId: string;
  initial?: ProblemInitial;
}) {
  const [state, formAction] = useFormState<ProblemFormState, FormData>(saveProblem, {});
  const isEdit = Boolean(initial?.id);
  const p = initial ?? {};

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      {initial?.id ? <input type="hidden" name="problemId" value={initial.id} /> : null}
      <div className="card">
        <h2>{isEdit ? '問題の編集' : '問題を追加'}</h2>
        <div className="field">
          <label htmlFor="title">問題名 *</label>
          <input id="title" name="title" required defaultValue={p.title ?? ''} />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="category">分類</label>
            <input id="category" name="category" placeholder="例: 運動器 / 婦人科" defaultValue={p.category ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="status">ステータス</label>
            <select id="status" name="status" defaultValue={p.status ?? 'active'}>
              {PROBLEM_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="diagnosis">診断・見立て</label>
            <input id="diagnosis" name="diagnosis" defaultValue={p.diagnosis ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="onset">発症</label>
            <input id="onset" name="onset" defaultValue={p.onset ?? ''} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="detail">詳細</label>
          <textarea id="detail" name="detail" rows={3} defaultValue={p.detail ?? ''} />
        </div>

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
