import { createAdminClient } from '@/lib/supabase/admin';
import { fmtJst, fmtTimeJst, STATUS_LABEL } from '@/lib/datetime';
import { cancelBooking } from './actions';

export const dynamic = 'force-dynamic';

interface Appt {
  start_at: string; end_at: string; status: string; title: string | null;
  guest_name: string | null; tenant: { name: string } | { name: string }[] | null;
}

function Notice({ msg }: { msg: string }) {
  return <div className="container" style={{ maxWidth: 560 }}><div className="notice">{msg}</div></div>;
}

export default async function AppointmentPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  if (!admin) return <Notice msg="サーバー未設定です。" />;

  const { data } = await admin
    .from('appointments')
    .select('start_at, end_at, status, title, guest_name, tenant:tenant_id(name)')
    .eq('booking_token', params.token)
    .maybeSingle();
  const a = data as Appt | null;
  if (!a) return <Notice msg="予約が見つかりません。" />;
  const tenantName = (Array.isArray(a.tenant) ? a.tenant[0]?.name : a.tenant?.name) ?? '';

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="topbar" style={{ borderRadius: 12, marginBottom: 16 }}>
        <span className="brand">WithMIKI<small>予約確認</small></span>
      </div>
      <div className="card">
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>予約内容</h1>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>院</dt><dd>{tenantName}</dd>
          <dt>日時</dt><dd>{fmtJst(a.start_at)}〜{fmtTimeJst(a.end_at)}</dd>
          <dt>お名前</dt><dd>{a.guest_name ?? ''}</dd>
          <dt>状態</dt><dd>{STATUS_LABEL[a.status] ?? a.status}</dd>
        </dl>
        {a.status === 'cancelled' ? (
          <p className="meta">この予約はキャンセルされています。</p>
        ) : (
          <form action={cancelBooking} style={{ marginTop: 8 }}>
            <input type="hidden" name="token" value={params.token} />
            <button className="btn secondary" type="submit" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              この予約をキャンセルする
            </button>
          </form>
        )}
      </div>
      <p className="meta" style={{ textAlign: 'center' }}>確定の連絡は院からご案内します。</p>
    </div>
  );
}
