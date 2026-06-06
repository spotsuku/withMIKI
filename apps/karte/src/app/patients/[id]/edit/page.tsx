import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { PatientForm, type PatientInitial } from '../../PatientForm';
import type { Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditPatientPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('patient')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) notFound();
  const p = data as Patient;

  const initial: PatientInitial = {
    id: p.id,
    name: p.name,
    kana: p.kana,
    code: p.code,
    dob: p.dob,
    sex: p.sex,
    blood_type: p.blood_type,
    tel: p.tel,
    email: p.email,
    address: p.address,
    job: p.job,
    first_visit_date: p.first_visit_date,
    hospital: p.hospital,
    avatar: p.avatar,
  };

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>
        <PatientForm initial={initial} />
      </div>
    </>
  );
}
