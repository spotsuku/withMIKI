import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { BodyCanvas } from './BodyCanvas';
import type { Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Mark { x: number; y: number; color: string }
interface BodyRow { view: string; marks: Mark[] | null; note: string | null }

export default async function BodyPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [patientRes, bodyRes] = await Promise.all([
    supabase.from('patient').select('id, name').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase.from('body_diagram').select('view, marks, note').eq('patient_id', params.id).is('visit_id', null),
  ]);
  if (!patientRes.data) notFound();
  const p = patientRes.data as Pick<Patient, 'id' | 'name'>;
  const rows = (bodyRes.data ?? []) as BodyRow[];
  const front = rows.find((r) => r.view === 'front');
  const back = rows.find((r) => r.view === 'back');

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>
        <h1 style={{ fontSize: '1.3rem' }}>人体図　<span className="meta">{p.name}</span></h1>
        <p className="meta">図をクリック/タップで色付きマークを追加できます。前面・背面は個別に保存します。</p>
        <div className="grid cols-2">
          <BodyCanvas
            patientId={p.id}
            view="front"
            initialMarks={front?.marks ?? []}
            initialNote={front?.note ?? ''}
          />
          <BodyCanvas
            patientId={p.id}
            view="back"
            initialMarks={back?.marks ?? []}
            initialNote={back?.note ?? ''}
          />
        </div>
      </div>
    </>
  );
}
