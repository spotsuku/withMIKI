import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { MediaForm } from './MediaForm';

export const dynamic = 'force-dynamic';

interface MRow { id: string; title: string | null; category: string | null; taken_date: string | null }

export default async function MediaPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const supabase = createClient();
  const { data } = await supabase
    .from('media')
    .select('id, title, category, taken_date')
    .eq('patient_id', ctx.patient.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(30);
  const media = (data ?? []) as MRow[];

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>記録</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/today">‹ 今日の記録</Link></p>
        <MediaForm />
        <div className="card">
          <h2>マイメディア</h2>
          {media.length ? (
            <ul className="patient-list">
              {media.map((m) => (
                <li key={m.id}>
                  <a href={`/api/media/${m.id}/url`} target="_blank" rel="noreferrer">
                    <span style={{ flex: 1 }}>{m.category ? <span className="tag">{m.category}</span> : null}<strong>{m.title ?? 'メディア'}</strong>{m.taken_date ? <span className="meta">　{m.taken_date}</span> : null}</span>
                    <span className="meta">表示 ›</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <div className="empty">まだありません</div>}
        </div>
      </div>
    </>
  );
}
