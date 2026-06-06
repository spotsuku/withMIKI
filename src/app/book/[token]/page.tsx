import { createAdminClient } from '@/lib/supabase/admin';
import { fmtJst, fmtTimeJst } from '@/lib/datetime';
import { BookingForm, type SlotOpt } from './BookingForm';

export const dynamic = 'force-dynamic';

interface Slot { id: string; start_at: string; end_at: string }

function Notice({ msg }: { msg: string }) {
  return <div className="container" style={{ maxWidth: 560 }}><div className="notice">{msg}</div></div>;
}

export default async function BookPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  if (!admin) return <Notice msg="予約機能はサーバー未設定です（SUPABASE_SERVICE_ROLE_KEY）。" />;

  const { data: ts } = await admin
    .from('tenant_settings')
    .select('tenant_id, tenant:tenant_id(name)')
    .eq('booking_token', params.token)
    .maybeSingle();
  const row = ts as { tenant_id: string; tenant: { name: string } | { name: string }[] | null } | null;
  if (!row) return <Notice msg="予約ページが見つかりません。リンクをご確認ください。" />;
  const tenantName = (Array.isArray(row.tenant) ? row.tenant[0]?.name : row.tenant?.name) ?? '';

  const { data } = await admin
    .from('appointment_slots')
    .select('id, start_at, end_at')
    .eq('tenant_id', row.tenant_id)
    .eq('is_blocked', false)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(60);
  const slots: SlotOpt[] = ((data ?? []) as Slot[]).map((s) => ({
    id: s.id,
    label: `${fmtJst(s.start_at)}〜${fmtTimeJst(s.end_at)}`,
  }));

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="topbar" style={{ borderRadius: 12, marginBottom: 16 }}>
        <span className="brand">WithMIKI<small>オンライン予約</small></span>
      </div>
      <div className="card"><h1 style={{ margin: 0, fontSize: '1.3rem' }}>{tenantName} 予約</h1></div>
      <BookingForm pageToken={params.token} slots={slots} />
    </div>
  );
}
