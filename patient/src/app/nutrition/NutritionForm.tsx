'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { saveNutritionGoal, type NutriState } from './actions';

export interface NutriInitial {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  target_weight?: number | null;
}

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : '保存する'}</button>;
}

export function NutritionForm({ initial }: { initial: NutriInitial }) {
  const [state, formAction] = useFormState<NutriState, FormData>(saveNutritionGoal, {});
  const i = initial;
  return (
    <form action={formAction}>
      <div className="card">
        <h2>栄養目標</h2>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="calories">カロリー（kcal）</label><input id="calories" name="calories" type="number" inputMode="decimal" defaultValue={i.calories ?? ''} /></div>
          <div className="field"><label htmlFor="protein">たんぱく質（g）</label><input id="protein" name="protein" type="number" inputMode="decimal" defaultValue={i.protein ?? ''} /></div>
          <div className="field"><label htmlFor="carbs">炭水化物（g）</label><input id="carbs" name="carbs" type="number" inputMode="decimal" defaultValue={i.carbs ?? ''} /></div>
          <div className="field"><label htmlFor="fat">脂質（g）</label><input id="fat" name="fat" type="number" inputMode="decimal" defaultValue={i.fat ?? ''} /></div>
          <div className="field"><label htmlFor="target_weight">目標体重（kg）</label><input id="target_weight" name="target_weight" type="number" step="0.1" inputMode="decimal" defaultValue={i.target_weight ?? ''} /></div>
        </div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <Save />
          <Link className="btn secondary" href="/food">キャンセル</Link>
        </div>
      </div>
    </form>
  );
}
