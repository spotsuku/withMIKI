import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { BodyCanvas } from './BodyCanvas';
import type { Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Mark { x: number; y: number; color: string; size?: number }
interface BodyRow { view: string; marks: Mark[] | null; note: string | null }

const LEGEND: [string, string][] = [
  ['#e63946', '痛み・急性症状'],
  ['#f08c00', '違和感・慢性症状'],
  ['#1d6fb8', '施術ポイント・鍼穴'],
  ['#2a9d4a', '改善・経過良好'],
  ['#7048e8', 'その他・要観察'],
];

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
        <h1 style={{ fontSize: '1.3rem' }}>人体図カルテ　<span className="meta">{p.name}</span></h1>
        <p className="meta">図をタップで色付きマークを追加できます。前面・背面は個別に保存します。</p>

        {/* 凡例 */}
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {LEGEND.map(([c, label]) => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.85rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: c, display: 'inline-block', boxShadow: '0 0 0 1px var(--line)' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

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
