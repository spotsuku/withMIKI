'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { addProblemSoap, type ProblemFormState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '追加中…' : 'SOAP を追加'}
    </button>
  );
}

export function SoapAddForm({
  patientId,
  problemId,
}: {
  patientId: string;
  problemId: string;
}) {
  const [state, formAction] = useFormState<ProblemFormState, FormData>(addProblemSoap, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="problemId" value={problemId} />
      <div className="field">
        <label htmlFor="note_date">日付 *</label>
        <input
          id="note_date"
          name="note_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>
      <div className="field">
        <label htmlFor="soap_s">S（主観的所見）</label>
        <textarea id="soap_s" name="soap_s" rows={2} />
      </div>
      <div className="field">
        <label htmlFor="soap_o">O（客観的所見）</label>
        <textarea id="soap_o" name="soap_o" rows={2} />
      </div>
      <div className="field">
        <label htmlFor="soap_a">A（評価）</label>
        <textarea id="soap_a" name="soap_a" rows={2} />
      </div>
      <div className="field">
        <label htmlFor="soap_p">P（計画）</label>
        <textarea id="soap_p" name="soap_p" rows={2} />
      </div>
      {state?.error ? <p className="error">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
