import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { SharingForm } from './SharingForm';

export const dynamic = 'force-dynamic';

export default async function SharingPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const supabase = createClient();
  const { data } = await supabase
    .from('patient_share_settings')
    .select('section, is_shared')
    .eq('patient_id', ctx.patient.id);
  const shared: Record<string, boolean> = {};
  for (const r of (data ?? []) as { section: string; is_shared: boolean }[]) shared[r.section] = r.is_shared;

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>マイページ</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/mypage">‹ マイページ</Link></p>
        <SharingForm shared={shared} />
      </div>
    </>
  );
}
