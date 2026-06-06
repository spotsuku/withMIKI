import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { PatientForm } from '../PatientForm';

export const dynamic = 'force-dynamic';

export default async function NewPatientPage() {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href="/patients">‹ 患者一覧</Link>
        </p>
        <PatientForm />
      </div>
    </>
  );
}
