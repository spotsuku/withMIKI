import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { createAdminClient } from '@/lib/supabase/admin';
import { fmtJst, fmtTimeJst } from '@/lib/datetime';
import { ReserveForm, type SlotOpt } from './ReserveForm';

export const dynamic = 'force-dynamic';

interface Slot { id: string; start_at: string; end_at: string }

export default async function ReservePage({ searchParams }: { searchParams: { done?: string } }) {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');

  const done = searchParams.done === '1';

  let slots: SlotOpt[] = [];
  if (ctx.patient) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin
        .from('appointment_slots')
        .select('id, start_at, end_at')
        .eq('tenant_id', ctx.patient.tenant_id)
        .eq('is_blocked', false)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(60);
      slots = ((data ?? []) as Slot[]).map((s) => ({ id: s.id, label: `${fmtJst(s.start_at)}〜${fmtTimeJst(s.end_at)}` }));
    }
  }

  return (
    <>
      <div className="topbar">
        <Link href="/mypage" className="brand">WithMIKI<small>予約</small></Link>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/mypage">‹ マイページ</Link></p>
        <h1 style={{ fontSize: '1.3rem' }}>予約する</h1>

        {done ? (
          <div className="card" style={{ background: 'var(--accent-soft)' }}>
            <p style={{ margin: 0 }}>✅ 予約を受け付けました。先生の確認後に確定します。</p>
            <p className="meta" style={{ marginTop: 8 }}><Link href="/mypage">マイページへ戻る</Link></p>
          </div>
        ) : null}

        {!ctx.patient ? (
          <div className="notice">このアカウントはまだ患者情報にひも付いていません。担当の先生にご連絡ください。</div>
        ) : (
          <div className="card">
            <ReserveForm slots={slots} />
          </div>
        )}
      </div>
    </>
  );
}
