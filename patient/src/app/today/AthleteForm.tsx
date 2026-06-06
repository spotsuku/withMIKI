'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveAthleteDaily, addTraining, type AthleteState } from './athleteActions';
import { TRAIN_TYPES, INTENSITY, CONDITION_OPTIONS } from '@/lib/athlete';

export interface AthleteInitial {
  record_date: string;
  weight?: number | null;
  body_fat?: number | null;
  muscle_mass?: number | null;
  hr?: number | null;
  sleep_hours?: number | null;
  condition?: string | null;
  injury?: string | null;
  memo?: string | null;
  trainings?: { type: string | null; duration_min: number | null; intensity: string | null; memo: string | null }[];
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>{pending ? '保存中…' : label}</button>;
}

export function AthleteForm({ initial }: { initial: AthleteInitial }) {
  const [dState, dAction] = useFormState<AthleteState, FormData>(saveAthleteDaily, {});
  const [tState, tAction] = useFormState<AthleteState, FormData>(addTraining, {});
  const i = initial;
  const [condition, setCondition] = useState<string>(i.condition ?? '');
  const [trainType, setTrainType] = useState<string>('');

  return (
    <>
      <form action={dAction}>
        <input type="hidden" name="record_date" value={i.record_date} />
        <input type="hidden" name="condition" value={condition} />
        <div className="card">
          <h2>コンディション</h2>
          <div className="chips">
            {CONDITION_OPTIONS.map(([v, l]) => (
              <button type="button" key={v} className={'chip' + (condition === v ? ' on' : '')} onClick={() => setCondition(condition === v ? '' : v)}>{l}</button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="injury">傷害・違和感</label>
            <input id="injury" name="injury" defaultValue={i.injury ?? ''} />
          </div>
        </div>

        <div className="card">
          <h2>体組成・バイタル</h2>
          <div className="grid cols-2">
            <div className="field"><label htmlFor="weight">体重（kg）</label><input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" defaultValue={i.weight ?? ''} /></div>
            <div className="field"><label htmlFor="body_fat">体脂肪（%）</label><input id="body_fat" name="body_fat" type="number" step="0.1" inputMode="decimal" defaultValue={i.body_fat ?? ''} /></div>
            <div className="field"><label htmlFor="muscle_mass">筋肉量（kg）</label><input id="muscle_mass" name="muscle_mass" type="number" step="0.1" inputMode="decimal" defaultValue={i.muscle_mass ?? ''} /></div>
            <div className="field"><label htmlFor="hr">安静時心拍（bpm）</label><input id="hr" name="hr" type="number" inputMode="numeric" defaultValue={i.hr ?? ''} /></div>
            <div className="field"><label htmlFor="sleep_hours">睡眠（時間）</label><input id="sleep_hours" name="sleep_hours" type="number" step="0.5" inputMode="decimal" defaultValue={i.sleep_hours ?? ''} /></div>
          </div>
          <div className="field"><label htmlFor="memo">メモ</label><textarea id="memo" name="memo" rows={2} defaultValue={i.memo ?? ''} /></div>
          {dState?.ok ? <p className="meta">✅ 保存しました。</p> : null}
          {dState?.error ? <p className="error">{dState.error}</p> : null}
          <Save label="デイリーを保存" />
        </div>
      </form>

      {/* トレーニング追加 */}
      <form action={tAction}>
        <input type="hidden" name="record_date" value={i.record_date} />
        <input type="hidden" name="train_type" value={trainType} />
        <div className="card">
          <h2>トレーニングを追加</h2>
          <div className="chips">
            {TRAIN_TYPES.map((t) => (
              <button type="button" key={t} className={'chip' + (trainType === t ? ' on' : '')} onClick={() => setTrainType(trainType === t ? '' : t)}>{t}</button>
            ))}
          </div>
          <div className="grid cols-2" style={{ marginTop: 10 }}>
            <div className="field"><label htmlFor="train_duration">時間（分）</label><input id="train_duration" name="train_duration" type="number" inputMode="numeric" /></div>
            <div className="field">
              <label htmlFor="train_intensity">強度</label>
              <select id="train_intensity" name="train_intensity" defaultValue="">
                <option value="">—</option>
                {INTENSITY.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor="train_memo">メモ</label><input id="train_memo" name="train_memo" /></div>
          {tState?.ok ? <p className="meta">✅ 追加しました。</p> : null}
          {tState?.error ? <p className="error">{tState.error}</p> : null}
          <Save label="トレーニングを追加" />
        </div>
      </form>

      {i.trainings && i.trainings.length > 0 ? (
        <div className="card">
          <h2>今日のトレーニング</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {i.trainings.map((t, idx) => (
              <li key={idx}>{t.type ?? '練習'} {t.duration_min ? `${t.duration_min}分` : ''} {t.intensity ?? ''} {t.memo ?? ''}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
