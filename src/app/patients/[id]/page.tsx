import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { KarteChat } from '@/components/KarteChat';
import { TrendChart, type Series } from '@/components/TrendChart';
import { ShareLinks, type ShareRow } from './share/ShareLinks';
import {
  ageFromDob,
  type Patient,
  type PatientIntake,
  type KarteCover,
  type Visit,
  type Problem,
  type LabResult,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: patient } = await supabase
    .from('patient')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!patient) notFound();
  const p = patient as Patient;

  // 主プログラム（カルテ種別）
  const { data: ppRow } = await supabase
    .from('patient_program')
    .select('is_primary, care_program:care_program_id(code, name)')
    .eq('patient_id', p.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();
  const ppRel = (ppRow as { care_program: { code: string; name: string } | { code: string; name: string }[] | null } | null)?.care_program;
  const program = Array.isArray(ppRel) ? ppRel[0] : ppRel;
  const programLabel = program?.code === 'gyneco' ? '婦人科' : program?.code === 'athlete' ? 'アスリート' : program ? '総合・一般' : null;

  // 関連データを並行取得
  const [intakeRes, coverRes, visitsRes, problemsRes, labsRes, mediaRes] = await Promise.all([
    supabase.from('patient_intake').select('*').eq('patient_id', p.id).maybeSingle(),
    supabase.from('karte_cover').select('*').eq('patient_id', p.id).maybeSingle(),
    supabase
      .from('visit')
      .select('id, visit_date, injury_part, injury_name, points, technique, treatments, memo')
      .eq('patient_id', p.id)
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
      .limit(10),
    supabase
      .from('problem')
      .select('id, title, category, status, detail')
      .eq('patient_id', p.id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('lab_result')
      .select('id, taken_date, source, comment')
      .eq('patient_id', p.id)
      .is('deleted_at', null)
      .order('taken_date', { ascending: false })
      .limit(5),
    supabase
      .from('media')
      .select('id, title, category, taken_date')
      .eq('patient_id', p.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const intake = intakeRes.data as PatientIntake | null;
  const cover = coverRes.data as KarteCover | null;
  const visits = (visitsRes.data ?? []) as Visit[];
  const problems = (problemsRes.data ?? []) as Problem[];
  const labs = (labsRes.data ?? []) as LabResult[];
  const media = (mediaRes.data ?? []) as { id: string; title: string | null; category: string | null; taken_date: string | null }[];

  // 有効な共有リンク
  const { data: shareRows } = await supabase
    .from('karte_share')
    .select('id, token, label, expires_at, revoked_at')
    .eq('patient_id', p.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  const shares = ((shareRows ?? []) as (ShareRow & { revoked_at: string | null })[])
    .filter((s) => !s.expires_at || new Date(s.expires_at) > new Date());

  // ===== 推移グラフ用データ =====
  // 施術時バイタル（体重・血圧）
  const { data: vitalTrendRaw } = await supabase
    .from('visit_vital')
    .select('weight, sbp, dbp, visit:visit_id(visit_date)')
    .not('visit', 'is', null);
  type VT = { weight: number | null; sbp: number | null; dbp: number | null; visit: { visit_date: string } | { visit_date: string }[] | null };
  const vt = ((vitalTrendRaw ?? []) as VT[])
    .map((r) => ({
      date: (Array.isArray(r.visit) ? r.visit[0]?.visit_date : r.visit?.visit_date) ?? '',
      weight: r.weight, sbp: r.sbp, dbp: r.dbp,
    }))
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const weightSeries: Series[] = [
    { name: '体重', color: '#8a6d3b', points: vt.filter((r) => r.weight != null).map((r) => ({ label: r.date.slice(5), value: r.weight as number })) },
  ];
  const bpSeries: Series[] = [
    { name: '収縮期', color: '#c0392b', points: vt.filter((r) => r.sbp != null).map((r) => ({ label: r.date.slice(5), value: r.sbp as number })) },
    { name: '拡張期', color: '#1d6fb8', points: vt.filter((r) => r.dbp != null).map((r) => ({ label: r.date.slice(5), value: r.dbp as number })) },
  ];

  // 採血の推移（Hb・フェリチン）
  const { data: labTrendRaw } = await supabase
    .from('lab_value')
    .select('test_code, value, lab_result:lab_result_id(taken_date)')
    .in('test_code', ['hb', 'ferritin']);
  type LV = { test_code: string; value: number | null; lab_result: { taken_date: string } | { taken_date: string }[] | null };
  const lv = ((labTrendRaw ?? []) as LV[])
    .map((r) => ({
      code: r.test_code,
      date: (Array.isArray(r.lab_result) ? r.lab_result[0]?.taken_date : r.lab_result?.taken_date) ?? '',
      value: r.value,
    }))
    .filter((r) => r.date && r.value != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const hbSeries: Series[] = [
    { name: 'Hb', color: '#c0392b', points: lv.filter((r) => r.code === 'hb').map((r) => ({ label: r.date.slice(5), value: r.value as number })) },
  ];
  const ferritinSeries: Series[] = [
    { name: 'フェリチン', color: '#8a6d3b', points: lv.filter((r) => r.code === 'ferritin').map((r) => ({ label: r.date.slice(5), value: r.value as number })) },
  ];
  const hasTrend =
    weightSeries[0].points.length + bpSeries[0].points.length + hbSeries[0].points.length + ferritinSeries[0].points.length > 0;
  const age = ageFromDob(p.dob);

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href="/patients">‹ 患者一覧</Link>
        </p>

        {/* ヘッダ */}
        <div className="card">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span className="avatar" style={{ width: 56, height: 56, fontSize: 28 }}>
              {p.avatar || '🧑'}
            </span>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>
                {p.name}
                {programLabel ? <span className="tag" style={{ marginLeft: 8, verticalAlign: 'middle' }}>{programLabel}</span> : null}
              </h1>
              <div className="meta">
                {p.kana ?? ''} {p.code ? `／ No.${p.code}` : ''}
              </div>
              <div className="meta">
                {p.sex ?? ''} {age !== null ? `${age}歳` : ''} {p.blood_type ? `／ ${p.blood_type}型` : ''}
              </div>
            </div>
            <Link className="btn secondary" href={`/patients/${p.id}/edit`}>
              基本情報を編集
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Link className="btn secondary" href={`/patients/${p.id}/body`}>
              🧍 人体図
            </Link>
            <Link className="btn secondary" href={`/patients/${p.id}/media/new`}>
              📷 メディア追加
            </Link>
          </div>
        </div>

        {/* ケアプラン（表紙） */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>ケアプラン</h2>
            <Link className="btn secondary" href={`/patients/${p.id}/cover/edit`}>
              編集
            </Link>
          </div>
          {cover ? (
            <dl className="kv" style={{ marginTop: 12 }}>
              {cover.purpose ? (<><dt>目的</dt><dd>{cover.purpose}</dd></>) : null}
              {cover.goal ? (<><dt>目標</dt><dd>{cover.goal}</dd></>) : null}
              {cover.diagnosis ? (<><dt>診断</dt><dd>{cover.diagnosis}</dd></>) : null}
              {cover.treatment ? (<><dt>治療方針</dt><dd>{cover.treatment}</dd></>) : null}
              {cover.therapist ? (<><dt>担当</dt><dd>{cover.therapist}</dd></>) : null}
              {cover.caution ? (<><dt>注意</dt><dd>{cover.caution}</dd></>) : null}
              {cover.next_visit ? (<><dt>次回</dt><dd>{cover.next_visit}</dd></>) : null}
            </dl>
          ) : (
            <div className="empty">未設定 — 「編集」から登録できます</div>
          )}
        </div>

        <div className="grid cols-2">
          {/* 問診 */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>問診</h2>
              <Link className="btn secondary" href={`/patients/${p.id}/intake/edit`}>
                編集
              </Link>
            </div>
            {intake ? (
              <dl className="kv">
                {intake.chief ? (<><dt>主訴</dt><dd>{intake.chief}</dd></>) : null}
                {intake.onset ? (<><dt>発症</dt><dd>{intake.onset}</dd></>) : null}
                {intake.current ? (<><dt>現病歴</dt><dd>{intake.current}</dd></>) : null}
                {intake.history ? (<><dt>既往歴</dt><dd>{intake.history}</dd></>) : null}
                {intake.meds ? (<><dt>服薬</dt><dd>{intake.meds}</dd></>) : null}
                {intake.note ? (<><dt>禁忌等</dt><dd>{intake.note}</dd></>) : null}
              </dl>
            ) : (
              <div className="empty">問診情報なし</div>
            )}
          </div>

          {/* 問題リスト */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>問題リスト</h2>
              <Link className="btn secondary" href={`/patients/${p.id}/problems/new`}>
                ＋ 追加
              </Link>
            </div>
            {problems.length ? (
              <ul style={{ paddingLeft: 0, margin: '12px 0 0', listStyle: 'none' }}>
                {problems.map((pr) => (
                  <li key={pr.id} style={{ marginBottom: 8 }}>
                    <Link href={`/patients/${p.id}/problems/${pr.id}/edit`}>
                      {pr.category ? <span className="tag">{pr.category}</span> : null}
                      <strong>{pr.title}</strong>
                      {pr.status === 'resolved' ? <span className="meta">（解決）</span> : null}
                      {pr.detail ? <div className="meta">{pr.detail}</div> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">問題なし</div>
            )}
          </div>
        </div>

        {/* 施術記録 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>施術記録（最近10件）</h2>
            <Link className="btn" href={`/patients/${p.id}/visits/new`}>
              ＋ 新規施術記録
            </Link>
          </div>
          {visits.length ? (
            <ul className="patient-list" style={{ marginTop: 12 }}>
              {visits.map((v) => (
                <li key={v.id}>
                  <Link href={`/patients/${p.id}/visits/${v.id}/edit`}>
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{v.visit_date}</span>
                      {v.treatments?.length
                        ? v.treatments.map((t) => (
                            <span className="tag" key={t} style={{ marginLeft: 8 }}>
                              {t}
                            </span>
                          ))
                        : null}
                      <br />
                      <span className="meta">
                        {[v.injury_part, v.injury_name].filter(Boolean).join(' ') || ''}
                        {v.points ? `／取穴: ${v.points}` : ''}
                        {v.technique ? `／手技: ${v.technique}` : ''}
                      </span>
                      {v.memo ? <div className="meta">{v.memo}</div> : null}
                    </span>
                    <span className="meta">編集 ›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">施術記録なし</div>
          )}
        </div>

        {/* 採血 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>採血（最近5件）</h2>
            <Link className="btn" href={`/patients/${p.id}/labs/new`}>
              ＋ 採血を入力
            </Link>
          </div>
          {labs.length ? (
            <ul className="patient-list" style={{ marginTop: 12 }}>
              {labs.map((l) => (
                <li key={l.id}>
                  <Link href={`/patients/${p.id}/labs/${l.id}/edit`}>
                    <span style={{ flex: 1 }}>
                      <strong>{l.taken_date}</strong>
                      <span className="meta">　{l.source === 'ocr' ? '画像OCR' : '手入力'}</span>
                      {l.comment ? <div className="meta">{l.comment}</div> : null}
                    </span>
                    <span className="meta">編集 ›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">採血記録なし</div>
          )}
        </div>

        {/* メディア */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>メディア</h2>
            <Link className="btn secondary" href={`/patients/${p.id}/media/new`}>
              ＋ 追加
            </Link>
          </div>
          {media.length ? (
            <ul className="patient-list" style={{ marginTop: 12 }}>
              {media.map((m) => (
                <li key={m.id}>
                  <a href={`/api/media/${m.id}/url`} target="_blank" rel="noreferrer">
                    <span style={{ flex: 1 }}>
                      {m.category ? <span className="tag">{m.category}</span> : null}
                      <strong>{m.title ?? 'メディア'}</strong>
                      {m.taken_date ? <span className="meta">　{m.taken_date}</span> : null}
                    </span>
                    <span className="meta">表示 ›</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">メディアなし</div>
          )}
        </div>

        {/* 推移グラフ */}
        {hasTrend ? (
          <>
            {weightSeries[0].points.length ? <TrendChart title="体重の推移" unit="kg" series={weightSeries} /> : null}
            {bpSeries[0].points.length || bpSeries[1].points.length ? <TrendChart title="血圧の推移" unit="mmHg" series={bpSeries} /> : null}
            {hbSeries[0].points.length ? <TrendChart title="Hb の推移" unit="g/dL" series={hbSeries} /> : null}
            {ferritinSeries[0].points.length ? <TrendChart title="フェリチンの推移" unit="ng/mL" series={ferritinSeries} /> : null}
          </>
        ) : null}

        {/* 共有リンク */}
        <ShareLinks patientId={p.id} shares={shares} />

        {/* AI カルテ補助 */}
        <KarteChat patientId={p.id} />
      </div>
    </>
  );
}
