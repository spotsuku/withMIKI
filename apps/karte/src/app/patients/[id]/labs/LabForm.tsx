'use client';

import Link from 'next/link';
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
  const values = initial?.values ?? {};

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
                    defaultValue={values[it.code] ?? ''}
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
