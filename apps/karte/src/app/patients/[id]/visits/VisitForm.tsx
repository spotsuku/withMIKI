'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { saveVisit, type VisitFormState } from './actions';
import { TREATMENT_OPTIONS, VITAL_FIELDS } from '@/lib/constants';

export interface VisitInitial {
  id?: string;
  visit_date?: string | null;
  injury_part?: string | null;
  injury_name?: string | null;
  disorder_part?: string | null;
  disorder_name?: string | null;
  points?: string | null;
  technique?: string | null;
  treatments?: string[] | null;
  memo?: string | null;
  vital?: Record<string, number | null> | null;
  soap?: { s?: string | null; o?: string | null; a?: string | null; p?: string | null } | null;
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : isEdit ? '更新する' : '作成する'}
    </button>
  );
}

export function VisitForm({
  patientId,
  patientName,
  initial,
}: {
  patientId: string;
  patientName: string;
  initial?: VisitInitial;
}) {
  const [state, formAction] = useFormState<VisitFormState, FormData>(saveVisit, {});
  const isEdit = Boolean(initial?.id);
  const tx = new Set(initial?.treatments ?? []);
  const v = initial?.vital ?? {};
  const soap = initial?.soap ?? {};

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      {initial?.id ? <input type="hidden" name="visitId" value={initial.id} /> : null}

      <div className="card">
        <h2>{isEdit ? '施術記録の編集' : '新規施術記録'}　<span className="meta">{patientName}</span></h2>
        <div className="field">
          <label htmlFor="visit_date">施術日 *</label>
          <input
            id="visit_date"
            name="visit_date"
            type="date"
            required
            defaultValue={initial?.visit_date ?? new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="grid cols-2">
          <div className="field">
            <label>傷害部位</label>
            <input name="injury_part" defaultValue={initial?.injury_part ?? ''} />
          </div>
          <div className="field">
            <label>傷害名</label>
            <input name="injury_name" defaultValue={initial?.injury_name ?? ''} />
          </div>
          <div className="field">
            <label>愁訴部位</label>
            <input name="disorder_part" defaultValue={initial?.disorder_part ?? ''} />
          </div>
          <div className="field">
            <label>愁訴名</label>
            <input name="disorder_name" defaultValue={initial?.disorder_name ?? ''} />
          </div>
        </div>

        <div className="field">
          <label>処置</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
            {TREATMENT_OPTIONS.map((t) => (
              <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink)' }}>
                <input type="checkbox" name={`tx_${t}`} defaultChecked={tx.has(t)} /> {t}
              </label>
            ))}
          </div>
        </div>

        <div className="grid cols-2">
          <div className="field">
            <label>取穴</label>
            <input name="points" defaultValue={initial?.points ?? ''} />
          </div>
          <div className="field">
            <label>手技</label>
            <input name="technique" defaultValue={initial?.technique ?? ''} />
          </div>
        </div>
      </div>

      {/* SOAP */}
      <div className="card">
        <h2>SOAP</h2>
        <div className="field">
          <label htmlFor="soap_s">S（主観的所見 / Subjective）</label>
          <textarea id="soap_s" name="soap_s" rows={2} defaultValue={soap.s ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="soap_o">O（客観的所見 / Objective）</label>
          <textarea id="soap_o" name="soap_o" rows={2} defaultValue={soap.o ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="soap_a">A（評価 / Assessment）</label>
          <textarea id="soap_a" name="soap_a" rows={2} defaultValue={soap.a ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="soap_p">P（計画 / Plan）</label>
          <textarea id="soap_p" name="soap_p" rows={2} defaultValue={soap.p ?? ''} />
        </div>
      </div>

      {/* バイタル */}
      <div className="card">
        <h2>バイタル（任意）</h2>
        <div className="grid cols-2">
          {VITAL_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>
                {f.label}
                {f.unit ? <span className="meta">（{f.unit}）</span> : null}
              </label>
              <input
                name={`v_${f.key}`}
                type="number"
                step={f.step ?? '1'}
                inputMode="decimal"
                defaultValue={v[f.key] ?? ''}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="memo">メモ</label>
          <textarea id="memo" name="memo" rows={3} defaultValue={initial?.memo ?? ''} />
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
