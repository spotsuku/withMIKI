import { ageFromDob } from '@/lib/types';

export interface BasicKarteData {
  patient: { name: string; kana?: string | null; dob?: string | null; sex?: string | null; blood_type?: string | null };
  cover?: Record<string, string | null> | null;
  intake?: Record<string, string | null> | null;
  problems?: { title: string; category: string | null; status: string; detail: string | null }[];
  visits?: { visit_date: string; injury_part?: string | null; injury_name?: string | null; treatments?: string[] | null; memo?: string | null }[];
  labs?: { taken_date: string; comment?: string | null }[];
}

/**
 * 基本カルテ（ケアプラン・問診・問題リスト・施術記録・採血）の読み取り表示。先生が記入した内容。
 * visible で先生が公開した部分のみ表示（既定はすべて公開）。
 */
export function BasicKarte({ data, visible, showHeader = true }: { data: BasicKarteData; visible?: Record<string, boolean>; showHeader?: boolean }) {
  const { patient: p, cover, intake, problems = [], visits = [], labs = [] } = data;
  const vis = (k: string) => visible?.[k] ?? true;
  const age = ageFromDob(p.dob ?? null);
  return (
    <>
      {showHeader ? (
        <div className="card">
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{p.name}</h1>
          {p.kana ? <div className="meta">{p.kana}</div> : null}
          <div className="meta">{p.sex ?? ''} {age !== null ? `${age}歳` : ''} {p.blood_type ? `／ ${p.blood_type}型` : ''}</div>
        </div>
      ) : null}

      {vis('careplan') && cover && Object.values(cover).some(Boolean) ? (
        <div className="card">
          <h2>ケアプラン（先生記入）</h2>
          <dl className="kv">
            {cover.purpose ? (<><dt>目的</dt><dd>{cover.purpose}</dd></>) : null}
            {cover.goal ? (<><dt>目標</dt><dd>{cover.goal}</dd></>) : null}
            {cover.diagnosis ? (<><dt>見立て</dt><dd>{cover.diagnosis}</dd></>) : null}
            {cover.treatment ? (<><dt>治療方針</dt><dd>{cover.treatment}</dd></>) : null}
            {cover.caution ? (<><dt>注意</dt><dd>{cover.caution}</dd></>) : null}
            {cover.therapist ? (<><dt>担当</dt><dd>{cover.therapist}</dd></>) : null}
            {cover.next_visit ? (<><dt>次回</dt><dd>{cover.next_visit}</dd></>) : null}
          </dl>
        </div>
      ) : null}

      {vis('intake') && intake && Object.values(intake).some(Boolean) ? (
        <div className="card">
          <h2>問診（先生記入）</h2>
          <dl className="kv">
            {intake.chief ? (<><dt>主訴</dt><dd>{intake.chief}</dd></>) : null}
            {intake.onset ? (<><dt>発症</dt><dd>{intake.onset}</dd></>) : null}
            {intake.current ? (<><dt>現病歴</dt><dd>{intake.current}</dd></>) : null}
            {intake.history ? (<><dt>既往歴</dt><dd>{intake.history}</dd></>) : null}
            {intake.meds ? (<><dt>服薬</dt><dd>{intake.meds}</dd></>) : null}
            {intake.note ? (<><dt>禁忌等</dt><dd>{intake.note}</dd></>) : null}
          </dl>
        </div>
      ) : null}

      {vis('problems') && problems.length ? (
        <div className="card">
          <h2>問題リスト</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {problems.map((pr, i) => (
              <li key={i}>{pr.category ? <span className="tag">{pr.category}</span> : null}<strong>{pr.title}</strong>{pr.status === 'resolved' ? '（解決）' : ''}{pr.detail ? ` — ${pr.detail}` : ''}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {vis('visits') && visits.length ? (
        <div className="card">
          <h2>施術記録</h2>
          <ul className="patient-list" style={{ marginTop: 8 }}>
            {visits.map((v, i) => (
              <li key={i}>
                <span style={{ flex: 1 }}>
                  <strong>{v.visit_date}</strong>
                  {v.treatments?.length ? v.treatments.map((t) => <span className="tag" key={t} style={{ marginLeft: 6 }}>{t}</span>) : null}
                  {(v.injury_part || v.injury_name) ? <div className="meta">{[v.injury_part, v.injury_name].filter(Boolean).join(' ')}</div> : null}
                  {v.memo ? <div className="meta">{v.memo}</div> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vis('labs') && labs.length ? (
        <div className="card">
          <h2>採血</h2>
          <ul className="patient-list" style={{ marginTop: 8 }}>
            {labs.map((l, i) => (
              <li key={i}><span style={{ flex: 1 }}><strong>{l.taken_date}</strong>{l.comment ? <div className="meta">{l.comment}</div> : null}</span></li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
