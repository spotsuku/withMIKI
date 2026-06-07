import { createAdminClient } from '@/lib/supabase/admin';
import { loadDailyInitial } from '@/lib/dailySave';
import { listDiary } from '@/lib/diaryCore';
import { RecordClient } from './RecordClient';

export const dynamic = 'force-dynamic';

type PatRel = { name: string; kana: string | null; dob: string | null; sex: string | null; blood_type: string | null };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container login-wrap">
      <div className="card"><h2>WithMIKI 記録</h2>{children}</div>
    </div>
  );
}

export default async function RecordTokenPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  if (!admin) return <Shell><p className="error">サーバー設定が未完了です。先生にご連絡ください。</p></Shell>;

  const { data } = await admin
    .from('patient_record_token')
    .select('patient_id, revoked, pin_hash, patient:patient_id(name, kana, dob, sex, blood_type)')
    .eq('token', params.token)
    .maybeSingle();
  const row = data as { patient_id: string; revoked: boolean; pin_hash: string | null; patient: PatRel | PatRel[] | null } | null;
  if (!row || row.revoked) return <Shell><p className="error">このURLは無効です。先生に再発行をご依頼ください。</p></Shell>;

  const pat = Array.isArray(row.patient) ? row.patient[0] : row.patient;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const initial = await loadDailyInitial(admin, row.patient_id, today);

  // 基本カルテ（先生が記入済み）＝表紙・問診・問題リスト
  const [coverRes, intakeRes, problemsRes] = await Promise.all([
    admin.from('karte_cover').select('purpose, goal, diagnosis, treatment, caution, therapist, doctor, start_date, next_visit').eq('patient_id', row.patient_id).maybeSingle(),
    admin.from('patient_intake').select('chief, onset, current, history, meds, note').eq('patient_id', row.patient_id).maybeSingle(),
    admin.from('problem').select('title, category, status, detail').eq('patient_id', row.patient_id).is('deleted_at', null).order('sort_order'),
  ]);
  const cover = (coverRes.data as Record<string, string | null> | null) ?? null;
  const intake = (intakeRes.data as Record<string, string | null> | null) ?? null;
  const problems = (problemsRes.data ?? []) as { title: string; category: string | null; status: string; detail: string | null }[];

  // 現在の共有設定
  const { data: shareRows } = await admin
    .from('patient_share_settings')
    .select('section, is_shared').eq('patient_id', row.patient_id);
  const shared: Record<string, boolean> = {};
  for (const r of (shareRows ?? []) as { section: string; is_shared: boolean }[]) shared[r.section] = r.is_shared;

  const diary = await listDiary(admin, row.patient_id);

  return (
    <RecordClient
      token={params.token}
      patientName={pat?.name ?? 'あなた'}
      hasPin={Boolean(row.pin_hash)}
      initial={initial}
      basicKarte={{ patient: pat ?? { name: 'あなた' }, cover, intake, problems }}
      shared={shared}
      diary={diary}
    />
  );
}
