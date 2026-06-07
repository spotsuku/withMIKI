import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { PatientList } from './PatientList';
import { type Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PatientsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <>
        <Topbar />
        <div className="container">
          <div className="notice">
            <strong>Supabase が未設定です。</strong>
            <p>
              <code>.env.local.example</code> をコピーして{' '}
              <code>.env.local</code> を作成し、<code>NEXT_PUBLIC_SUPABASE_URL</code> と{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> を設定してください。
              手順は <code>docs/setup/supabase-setup.md</code>。
            </p>
          </div>
        </div>
      </>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('patient')
    .select('id, code, name, kana, dob, sex, avatar, status, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const patients = (data ?? []) as Patient[];

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.3rem' }}>
            患者一覧 <span className="meta">{patients.length} 名</span>
          </h1>
          <Link className="btn" href="/patients/new">
            ＋ 新規患者
          </Link>
        </div>

        {error ? (
          <div className="notice" style={{ marginTop: 12 }}>
            データ取得でエラーが発生しました：{error.message}
            <br />
            マイグレーション適用と app_user のひも付けをご確認ください
            （docs/setup/supabase-setup.md §4）。
          </div>
        ) : null}

        <PatientList patients={patients} />
      </div>
    </>
  );
}
