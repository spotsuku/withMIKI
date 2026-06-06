import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { LabForm, type LabInitial } from '../../LabForm';
import { deleteLab } from '../../actions';
import { groupLabCatalog, type LabTestCatalog, type Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface LabValueRow {
  test_code: string;
  value: number | null;
  value_text: string | null;
}

export default async function EditLabPage({
  params,
}: {
  params: { id: string; labId: string };
}) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [patientRes, labRes, valuesRes, catalogRes] = await Promise.all([
    supabase.from('patient').select('id, name').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase.from('lab_result').select('*').eq('id', params.labId).is('deleted_at', null).maybeSingle(),
    supabase.from('lab_value').select('test_code, value, value_text').eq('lab_result_id', params.labId),
    supabase
      .from('lab_test_catalog')
      .select('code, name, unit, ref_low, ref_high, category, sort_order')
      .order('sort_order', { ascending: true }),
  ]);

  if (!patientRes.data || !labRes.data) notFound();
  const p = patientRes.data as Pick<Patient, 'id' | 'name'>;
  const lab = labRes.data as Record<string, unknown>;
  const groups = groupLabCatalog((catalogRes.data ?? []) as LabTestCatalog[]);

  const values: Record<string, string> = {};
  for (const row of (valuesRes.data ?? []) as LabValueRow[]) {
    values[row.test_code] = row.value !== null ? String(row.value) : row.value_text ?? '';
  }

  const initial: LabInitial = {
    id: lab.id as string,
    taken_date: lab.taken_date as string,
    comment: lab.comment as string | null,
    values,
  };

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>
        <LabForm patientId={p.id} patientName={p.name} groups={groups} initial={initial} />

        <div className="card">
          <h2>削除</h2>
          <form action={deleteLab}>
            <input type="hidden" name="patientId" value={p.id} />
            <input type="hidden" name="labId" value={initial.id} />
            <button
              className="btn secondary"
              type="submit"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              この採血記録を削除
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
