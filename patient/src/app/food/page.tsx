import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { FoodForm } from './FoodForm';

export const dynamic = 'force-dynamic';

interface FoodRow { id: string; meal: string | null; memo: string | null; calories: number | null }

export default async function FoodPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const today = new Date().toISOString().slice(0, 10);
  const supabase = createClient();
  const { data } = await supabase
    .from('food_entry')
    .select('id, meal, memo, calories')
    .eq('patient_id', ctx.patient.id)
    .eq('entry_date', today)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  const foods = (data ?? []) as FoodRow[];
  const total = foods.reduce((s, f) => s + (f.calories ?? 0), 0);

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>記録</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/today">‹ 今日の記録</Link></p>
        <h1 style={{ fontSize: '1.3rem' }}>食事 <span className="meta">{today}</span></h1>
        <FoodForm entryDate={today} />
        <div className="card">
          <h2>今日の食事（合計 {total} kcal）</h2>
          {foods.length ? (
            <ul className="patient-list">
              {foods.map((f) => (
                <li key={f.id}><div style={{ padding: '8px 4px' }}>
                  <strong>{f.meal ?? '食事'}</strong>
                  <span className="meta">　{f.calories != null ? `${f.calories} kcal` : ''}</span>
                  {f.memo ? <div className="meta">{f.memo}</div> : null}
                </div></li>
              ))}
            </ul>
          ) : <div className="empty">まだ記録がありません</div>}
        </div>
      </div>
    </>
  );
}
