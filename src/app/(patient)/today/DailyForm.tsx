'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveDaily, type DailyState } from './actions';
import { Chips } from '@/components/Chips';
import { Section } from '@/components/Section';
import { GYNECO_CHIPS, GYNECO_EXTRA_CHIPS, SELFCARES, MEDS } from '@/lib/gyneco';

export interface DailyInitial {
  record_date: string;
  weight?: number | null;
  body_fat?: number | null;
  body_temp?: number | null;
  height?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  hr?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: string | null;
  water?: number | null;
  memo?: string | null;
  bbt?: number | null;
  pain?: number | null;
  gyneco?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  selfcare?: string[];
  meds?: string[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? '保存中…' : '保存する'}
    </button>
  );
}

// 婦人科チップを意味のあるグループに分けて表示（アコーディオン）
const GROUPS: { title: string; keys: string[] }[] = [
  { title: '🌸 月経・出血', keys: ['menstrual', 'flow', 'bloodState'] },
  { title: '💧 おりもの・排卵', keys: ['dischargeAmt', 'dischargeState', 'cervical', 'ovTest', 'ovPain'] },
  { title: '💗 性交・乳房', keys: ['sex', 'sexNote', 'breast'] },
  { title: '💊 PMS・PMDD', keys: ['pmsPhysical', 'pmsMental'] },
  { title: '📍 痛みの部位', keys: ['painLocation'] },
  { title: '🌿 東洋医学（冷え・舌診）', keys: ['chillArea', 'edemaArea', 'tongue', 'oriental'] },
];

export function DailyForm({ initial }: { initial: DailyInitial }) {
  const [state, formAction] = useFormState<DailyState, FormData>(saveDaily, {});
  const i = initial;
  const g = i.gyneco ?? {};
  const pl = i.payload ?? {};
  const chip = (key: string) => GYNECO_CHIPS.find((c) => c.key === key);

  return (
    <form action={formAction}>
      <input type="hidden" name="record_date" value={i.record_date} />

      {/* 基礎体温は最重要なので常時表示 */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🌡 基礎体温・痛み</h2>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="bbt">基礎体温（℃）</label>
            <input id="bbt" name="bbt" type="number" step="0.01" inputMode="decimal" defaultValue={i.bbt ?? ''} placeholder="36.50" />
          </div>
          <div className="field">
            <label htmlFor="pain">痛みスコア（0〜10）</label>
            <input id="pain" name="pain" type="number" min={0} max={10} inputMode="numeric" defaultValue={i.pain ?? ''} />
          </div>
        </div>
      </div>

      {GROUPS.map((grp) => (
        <Section key={grp.title} title={grp.title}>
          {grp.keys.map((k) => {
            const group = chip(k);
            if (!group) return null;
            return (
              <Chips key={group.key} group={group}
                initialSingle={group.type === 'single' ? (g[group.col as string] as string) : undefined}
                initialMulti={group.type === 'multi' ? (g[group.col as string] as string[]) : undefined} />
            );
          })}
        </Section>
      ))}

      <Section title="⚖️ 身体計測・バイタル">
        <div className="grid cols-2">
          <div className="field"><label htmlFor="height">身長（cm）</label><input id="height" name="height" type="number" step="0.1" inputMode="decimal" defaultValue={i.height ?? ''} /></div>
          <div className="field"><label htmlFor="weight">体重（kg）</label><input id="weight" name="weight" type="number" step="0.1" inputMode="decimal" defaultValue={i.weight ?? ''} /></div>
          <div className="field"><label htmlFor="body_fat">体脂肪（%）</label><input id="body_fat" name="body_fat" type="number" step="0.1" inputMode="decimal" defaultValue={i.body_fat ?? ''} /></div>
          <div className="field"><label htmlFor="body_temp">体温（℃）</label><input id="body_temp" name="body_temp" type="number" step="0.1" inputMode="decimal" defaultValue={i.body_temp ?? ''} /></div>
          <div className="field"><label htmlFor="sbp">血圧 上（収縮期）</label><input id="sbp" name="sbp" type="number" inputMode="numeric" defaultValue={i.sbp ?? ''} /></div>
          <div className="field"><label htmlFor="dbp">血圧 下（拡張期）</label><input id="dbp" name="dbp" type="number" inputMode="numeric" defaultValue={i.dbp ?? ''} /></div>
          <div className="field"><label htmlFor="hr">脈拍（bpm）</label><input id="hr" name="hr" type="number" inputMode="numeric" defaultValue={i.hr ?? ''} /></div>
        </div>
      </Section>

      <Section title="🌙 睡眠・気分・生活">
        <div className="grid cols-2">
          <div className="field"><label htmlFor="sleep_hours">睡眠（時間）</label><input id="sleep_hours" name="sleep_hours" type="number" step="0.5" inputMode="decimal" defaultValue={i.sleep_hours ?? ''} /></div>
          <div className="field">
            <label htmlFor="sleep_quality">睡眠の質</label>
            <select id="sleep_quality" name="sleep_quality" defaultValue={i.sleep_quality ?? ''}>
              <option value="">-</option>
              {['よく眠れた', 'ふつう', 'あまり眠れない', '不眠'].map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="water">水分（L）</label><input id="water" name="water" type="number" step="0.1" inputMode="decimal" defaultValue={i.water ?? ''} /></div>
        </div>
        {GYNECO_EXTRA_CHIPS.filter((grp) => ['mood', 'energy', 'lifestyle'].includes(grp.key)).map((group) => (
          <Chips key={group.key} group={group}
            initialSingle={group.type === 'single' ? (pl[group.key] as string) : undefined}
            initialMulti={group.type === 'multi' ? (pl[group.key] as string[]) : undefined} />
        ))}
      </Section>

      <Section title="🌿 便通・消化・頭痛・肌髪">
        {GYNECO_EXTRA_CHIPS.filter((grp) => ['bowel', 'stoolState', 'urine', 'headache', 'headacheNote', 'skin', 'hair'].includes(grp.key)).map((group) => (
          <Chips key={group.key} group={group}
            initialSingle={group.type === 'single' ? (pl[group.key] as string) : undefined}
            initialMulti={group.type === 'multi' ? (pl[group.key] as string[]) : undefined} />
        ))}
      </Section>

      <Section title="🧘 セルフケア">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SELFCARES.map((sc) => (
            <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
              <input type="checkbox" name={`sc_${sc.id}`} defaultChecked={i.selfcare?.includes(sc.id)} />
              <span>{sc.icon} {sc.name}<span className="meta">（{sc.sub}）</span></span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="💊 服薬・サプリ">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
          {MEDS.map((m) => (
            <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink)' }}>
              <input type="checkbox" name={`med_${m}`} defaultChecked={i.meds?.includes(m)} /> {m}
            </label>
          ))}
        </div>
      </Section>

      <Section title="📝 先生へのメモ・体調" defaultOpen>
        <textarea id="memo" name="memo" rows={3} defaultValue={i.memo ?? ''} placeholder="体の変化・気になること・先生に伝えたいことなど自由に…" />
      </Section>

      <div className="card">
        {state?.ok ? <p className="meta">✅ 保存しました。</p> : null}
        {state?.error ? <p className="error">{state.error}</p> : null}
        <SubmitButton />
      </div>
    </form>
  );
}
