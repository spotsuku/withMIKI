import { createAdminClient } from '@/lib/supabase/admin';
import { loadDailyInitial } from '@/lib/dailySave';
import { RecordClient } from './RecordClient';

export const dynamic = 'force-dynamic';

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
    .select('patient_id, revoked, pin_hash, patient:patient_id(name)')
    .eq('token', params.token)
    .maybeSingle();
  const row = data as { patient_id: string; revoked: boolean; pin_hash: string | null; patient: { name: string } | { name: string }[] | null } | null;
  if (!row || row.revoked) return <Shell><p className="error">このURLは無効です。先生に再発行をご依頼ください。</p></Shell>;

  const pat = Array.isArray(row.patient) ? row.patient[0] : row.patient;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const initial = await loadDailyInitial(admin, row.patient_id, today);

  return (
    <RecordClient
      token={params.token}
      patientName={pat?.name ?? 'あなた'}
      hasPin={Boolean(row.pin_hash)}
      initial={initial}
    />
  );
}
