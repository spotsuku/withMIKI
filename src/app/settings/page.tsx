import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { getUserContext } from '@/lib/auth';
import { LineLinkButton } from './LineLinkButton';
import { TestLineButton } from './TestLineButton';
import { StaffPanel } from './StaffPanel';
import { ClinicForm } from './ClinicForm';
import { listStaff } from './staff-actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect('/patients');
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  if (!ctx.appUser) redirect('/'); // 患者はトップへ（ロール振り分け）

  const supabase = createClient();
  const { data } = await supabase.from('app_user').select('line_user_id').eq('id', ctx.appUser.id).maybeSingle();
  const linked = Boolean((data as { line_user_id: string | null } | null)?.line_user_id);
  const { data: tenantRow } = await supabase.from('tenant').select('name').eq('id', ctx.appUser.tenant_id).maybeSingle();
  const clinicName = (tenantRow as { name: string } | null)?.name ?? '';
  const staff = await listStaff();

  return (
    <>
      <Topbar userEmail={ctx.user.email} />
      <div className="container">
        <p className="meta"><Link href="/patients">‹ カルテ一覧</Link></p>
        <h1 style={{ fontSize: '1.3rem' }}>設定</h1>

        <div className="card">
          <h2>アカウント</h2>
          <dl className="kv">
            <dt>名前</dt><dd>{ctx.appUser.name}</dd>
            <dt>メール</dt><dd>{ctx.user.email}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>院情報</h2>
          <ClinicForm name={clinicName} />
        </div>

        <div className="card">
          <h2>LINEログイン連携</h2>
          <LineLinkButton linked={linked} />
          {linked ? <TestLineButton /> : null}
        </div>

        <StaffPanel staff={staff} />
      </div>
    </>
  );
}
