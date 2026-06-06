import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { LabForm, type CatItem } from './LabForm';

export const dynamic = 'force-dynamic';

export default async function LabsPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const supabase = createClient();
  const { data } = await supabase
    .from('lab_test_catalog')
    .select('code, name, unit, category, sort_order')
    .order('sort_order', { ascending: true });
  const items = (data ?? []) as (CatItem & { sort_order: number })[];
  const map = new Map<string, CatItem[]>();
  for (const it of items) {
    const c = it.category ?? 'その他';
    if (!map.has(c)) map.set(c, []);
    map.get(c)!.push(it);
  }
  const groups = Array.from(map.entries()).map(([category, items]) => ({ category, items }));

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>記録</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/today">‹ 今日の記録</Link></p>
        <LabForm groups={groups} />
      </div>
    </>
  );
}
