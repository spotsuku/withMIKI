import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { VisitForm, type VisitInitial } from '../../VisitForm';
import { deleteVisit } from '../../actions';
import type { Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditVisitPage({
  params,
}: {
  params: { id: string; visitId: string };
}) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [patientRes, visitRes, vitalRes, soapRes] = await Promise.all([
    supabase.from('patient').select('id, name').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase.from('visit').select('*').eq('id', params.visitId).is('deleted_at', null).maybeSingle(),
    supabase.from('visit_vital').select('*').eq('visit_id', params.visitId).maybeSingle(),
    supabase.from('soap_note').select('s, o, a, p').eq('visit_id', params.visitId).limit(1).maybeSingle(),
  ]);

  if (!patientRes.data || !visitRes.data) notFound();
  const p = patientRes.data as Pick<Patient, 'id' | 'name'>;
  const visit = visitRes.data as Record<string, unknown>;
  const vital = (vitalRes.data as Record<string, number | null> | null) ?? null;
  const soap = (soapRes.data as VisitInitial['soap']) ?? null;

  const initial: VisitInitial = {
    id: visit.id as string,
    visit_date: visit.visit_date as string,
    injury_part: visit.injury_part as string | null,
    injury_name: visit.injury_name as string | null,
    disorder_part: visit.disorder_part as string | null,
    disorder_name: visit.disorder_name as string | null,
    points: visit.points as string | null,
    technique: visit.technique as string | null,
    treatments: (visit.treatments as string[] | null) ?? [],
    memo: visit.memo as string | null,
    vital,
    soap,
  };

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>
        <VisitForm patientId={p.id} patientName={p.name} initial={initial} />

        <div className="card">
          <h2>削除</h2>
          <form action={deleteVisit}>
            <input type="hidden" name="patientId" value={p.id} />
            <input type="hidden" name="visitId" value={initial.id} />
            <button className="btn secondary" type="submit" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              この施術記録を削除
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
