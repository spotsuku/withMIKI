import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { VisitForm } from '../VisitForm';
import type { Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewVisitPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: patient } = await supabase
    .from('patient')
    .select('id, name')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!patient) notFound();
  const p = patient as Pick<Patient, 'id' | 'name'>;

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>
        <VisitForm patientId={p.id} patientName={p.name} />
      </div>
    </>
  );
}
