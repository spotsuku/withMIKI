import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { CoverForm, type CoverInitial } from '../../karte/CoverForm';
import type { Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditCoverPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [patientRes, coverRes] = await Promise.all([
    supabase.from('patient').select('id, name').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase.from('karte_cover').select('*').eq('patient_id', params.id).maybeSingle(),
  ]);
  if (!patientRes.data) notFound();
  const p = patientRes.data as Pick<Patient, 'id' | 'name'>;
  const initial = (coverRes.data as CoverInitial | null) ?? null;

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>
        <CoverForm patientId={p.id} patientName={p.name} initial={initial} />
      </div>
    </>
  );
}
