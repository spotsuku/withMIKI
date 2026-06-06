'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addFood, type FoodState } from './actions';

const MEALS = ['朝', '昼', '夕', '間食'];

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const res = String(r.result); resolve({ data: res.slice(res.indexOf(',') + 1), mediaType: file.type || 'image/jpeg' }); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>{pending ? '保存中…' : '記録する'}</button>;
}

export function FoodForm({ entryDate }: { entryDate: string }) {
  const [state, formAction] = useFormState<FoodState, FormData>(addFood, {});
  const [meal, setMeal] = useState('朝');
  const [vals, setVals] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [analysis, setAnalysis] = useState<string>('');
  const [ocr, setOcr] = useState<{ loading: boolean; msg?: string; error?: string }>({ loading: false });

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setOcr({ loading: true });
    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/ai/food-analysis', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, mediaType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '解析に失敗しました');
      const a = json.analysis ?? {};
      setVals({
        calories: a.calories != null ? String(a.calories) : '',
        protein: a.protein != null ? String(a.protein) : '',
        carbs: a.carbs != null ? String(a.carbs) : '',
        fat: a.fat != null ? String(a.fat) : '',
      });
      setAnalysis(JSON.stringify(a));
      setOcr({ loading: false, msg: `推定: ${a.calories ?? '?'}kcal（${(a.items ?? []).join('・')}）。確認して記録してください。` });
    } catch (e) {
      setOcr({ loading: false, error: (e as Error).message });
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="entry_date" value={entryDate} />
      <input type="hidden" name="meal" value={meal} />
      <input type="hidden" name="ai_analysis" value={analysis} />
      <div className="card">
        <h2>食事を記録</h2>
        <div className="chips">
          {MEALS.map((m) => (
            <button type="button" key={m} className={'chip' + (meal === m ? ' on' : '')} onClick={() => setMeal(m)}>{m}</button>
          ))}
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>写真からAI解析（任意）</label>
          <input type="file" accept="image/*" capture="environment" disabled={ocr.loading} onChange={(e) => onPhoto(e.target.files?.[0])} />
          {ocr.loading ? <p className="meta">解析中…</p> : null}
          {ocr.msg ? <p className="meta">✅ {ocr.msg}</p> : null}
          {ocr.error ? <p className="error">{ocr.error}</p> : null}
        </div>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="calories">カロリー（kcal）</label><input id="calories" name="calories" type="number" inputMode="decimal" value={vals.calories} onChange={(e) => setVals({ ...vals, calories: e.target.value })} /></div>
          <div className="field"><label htmlFor="protein">たんぱく質（g）</label><input id="protein" name="protein" type="number" inputMode="decimal" value={vals.protein} onChange={(e) => setVals({ ...vals, protein: e.target.value })} /></div>
          <div className="field"><label htmlFor="carbs">炭水化物（g）</label><input id="carbs" name="carbs" type="number" inputMode="decimal" value={vals.carbs} onChange={(e) => setVals({ ...vals, carbs: e.target.value })} /></div>
          <div className="field"><label htmlFor="fat">脂質（g）</label><input id="fat" name="fat" type="number" inputMode="decimal" value={vals.fat} onChange={(e) => setVals({ ...vals, fat: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="memo">メモ</label><input id="memo" name="memo" /></div>
        {state?.ok ? <p className="meta">✅ 記録しました。</p> : null}
        {state?.error ? <p className="error">{state.error}</p> : null}
        <Save />
      </div>
    </form>
  );
}
