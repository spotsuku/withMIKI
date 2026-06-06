import { createAdminClient } from '@/lib/supabase/admin';
import { ageFromDob } from '@/lib/types';
import './../../globals.css';

export const dynamic = 'force-dynamic';

interface Share { patient_id: string; scope: string; expires_at: string | null; revoked_at: string | null }

function Invalid({ msg }: { msg: string }) {
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="notice">{msg}</div>
    </div>
  );
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  if (!admin) return <Invalid msg="共有機能はサーバー未設定です（SUPABASE_SERVICE_ROLE_KEY）。" />;

  const { data: shareRow } = await admin
    .from('karte_share')
    .select('patient_id, scope, expires_at, revoked_at')
    .eq('token', params.token)
    .maybeSingle();
  const share = shareRow as Share | null;
  if (!share || share.revoked_at) return <Invalid msg="このリンクは無効です。" />;
  if (share.expires_at && new Date(share.expires_at) < new Date()) return <Invalid msg="このリンクは有効期限が切れています。" />;

  const pid = share.patient_id;
  const [patRes, intakeRes, coverRes, problemsRes] = await Promise.all([
    admin.from('patient').select('name, kana, dob, sex, blood_type').eq('id', pid).maybeSingle(),
    admin.from('patient_intake').select('chief, onset, current, history, sleep, appetite, meds, note').eq('patient_id', pid).maybeSingle(),
    admin.from('karte_cover').select('purpose, goal, diagnosis, treatment, caution, therapist, next_visit').eq('patient_id', pid).maybeSingle(),
    admin.from('problem').select('title, category, status, detail').eq('patient_id', pid).is('deleted_at', null).order('sort_order'),
  ]);
  const p = patRes.data as { name: string; kana: string | null; dob: string | null; sex: string | null; blood_type: string | null } | null;
  if (!p) return <Invalid msg="カルテが見つかりません。" />;
  const intake = intakeRes.data as Record<string, string | null> | null;
  const cover = coverRes.data as Record<string, string | null> | null;
  const problems = (problemsRes.data ?? []) as { title: string; category: string | null; status: string; detail: string | null }[];
  const age = ageFromDob(p.dob);

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="topbar" style={{ borderRadius: 12, marginBottom: 16 }}>
        <span className="brand">WithMIKI<small>基本カルテ（共有）</small></span>
      </div>

      <div className="card">
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{p.name}</h1>
        <div className="meta">{p.kana ?? ''}</div>
        <div className="meta">{p.sex ?? ''} {age !== null ? `${age}歳` : ''} {p.blood_type ? `／ ${p.blood_type}型` : ''}</div>
      </div>

      {cover ? (
        <div className="card">
          <h2>ケアプラン</h2>
          <dl className="kv">
            {cover.purpose ? (<><dt>目的</dt><dd>{cover.purpose}</dd></>) : null}
            {cover.goal ? (<><dt>目標</dt><dd>{cover.goal}</dd></>) : null}
            {cover.diagnosis ? (<><dt>診断</dt><dd>{cover.diagnosis}</dd></>) : null}
            {cover.treatment ? (<><dt>治療方針</dt><dd>{cover.treatment}</dd></>) : null}
            {cover.caution ? (<><dt>注意</dt><dd>{cover.caution}</dd></>) : null}
            {cover.therapist ? (<><dt>担当</dt><dd>{cover.therapist}</dd></>) : null}
            {cover.next_visit ? (<><dt>次回</dt><dd>{cover.next_visit}</dd></>) : null}
          </dl>
        </div>
      ) : null}

      {intake ? (
        <div className="card">
          <h2>問診</h2>
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

      {problems.length ? (
        <div className="card">
          <h2>問題リスト</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {problems.map((pr, i) => (
              <li key={i}>{pr.category ? <span className="tag">{pr.category}</span> : null}<strong>{pr.title}</strong>{pr.status === 'resolved' ? '（解決）' : ''}{pr.detail ? ` — ${pr.detail}` : ''}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="meta" style={{ textAlign: 'center', marginTop: 16 }}>
        WithMIKI 基本カルテ共有ページ（閲覧専用）
      </p>
    </div>
  );
}
