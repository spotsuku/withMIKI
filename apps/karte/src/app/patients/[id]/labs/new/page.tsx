import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { LabForm } from '../LabForm';
import { groupLabCatalog, type LabTestCatalog, type Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewLabPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [patientRes, catalogRes] = await Promise.all([
    supabase.from('patient').select('id, name').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase
      .from('lab_test_catalog')
      .select('code, name, unit, ref_low, ref_high, category, sort_order')
      .order('sort_order', { ascending: true }),
  ]);
  if (!patientRes.data) notFound();
  const p = patientRes.data as Pick<Patient, 'id' | 'name'>;
  const groups = groupLabCatalog((catalogRes.data ?? []) as LabTestCatalog[]);

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>
        <LabForm patientId={p.id} patientName={p.name} groups={groups} />
      </div>
    </>
  );
}
