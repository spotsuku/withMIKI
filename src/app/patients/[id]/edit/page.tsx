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

  const { data: pp } = await supabase
    .from('patient_program')
    .select('is_primary, care_program:care_program_id(code)')
    .eq('patient_id', p.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();
  const cpRel = (pp as { care_program: { code: string } | { code: string }[] | null } | null)?.care_program;
  const programCode = (Array.isArray(cpRel) ? cpRel[0]?.code : cpRel?.code) ?? 'gyneco';

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
    program: programCode,
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
