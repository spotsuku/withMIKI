import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { NutritionForm, type NutriInitial } from './NutritionForm';

export const dynamic = 'force-dynamic';

export default async function NutritionPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const supabase = createClient();
  const { data } = await supabase
    .from('nutrition_goal')
    .select('calories, protein, carbs, fat, target_weight')
    .eq('patient_id', ctx.patient.id)
    .maybeSingle();

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>記録</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/food">‹ 食事</Link></p>
        <NutritionForm initial={(data as NutriInitial | null) ?? {}} />
      </div>
    </>
  );
}
