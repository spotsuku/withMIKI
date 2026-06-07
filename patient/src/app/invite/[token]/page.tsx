import { createAdminClient } from '@/lib/supabase/admin';
import { InviteClient } from './InviteClient';

export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  if (!admin) {
    return <Shell><p className="error">サーバー設定が未完了です。先生にご連絡ください。</p></Shell>;
  }

  const { data } = await admin
    .from('patient_invite')
    .select('patient_id, expires_at, used_at, patient:patient_id(name)')
    .eq('token', params.token)
    .maybeSingle();
  const inv = data as { patient_id: string; expires_at: string; used_at: string | null; patient: { name: string } | { name: string }[] | null } | null;

  if (!inv) return <Shell><p className="error">この招待リンクは無効です。先生に再発行をご依頼ください。</p></Shell>;
  if (inv.used_at) return <Shell><p className="meta">この招待は既に使用済みです。ログイン画面からログインしてください。</p><p><a className="btn" href="/login">ログインへ</a></p></Shell>;
  if (new Date(inv.expires_at) < new Date()) return <Shell><p className="error">この招待リンクは有効期限が切れています。先生に再発行をご依頼ください。</p></Shell>;

  const pat = Array.isArray(inv.patient) ? inv.patient[0] : inv.patient;
  return <InviteClient token={params.token} patientName={pat?.name ?? 'あなた'} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI ログイン招待</h2>
        {children}
      </div>
    </div>
  );
}
