import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { BasicKarte } from '@/components/BasicKarte';

export const dynamic = 'force-dynamic';

export default async function MyKartePage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const supabase = createClient();
  const pid = ctx.patient.id;
  const [patRes, coverRes, intakeRes, problemsRes] = await Promise.all([
    supabase.from('patient').select('name, kana, dob, sex, blood_type').eq('id', pid).maybeSingle(),
    supabase.from('karte_cover').select('purpose, goal, diagnosis, treatment, caution, therapist, doctor, next_visit').eq('patient_id', pid).maybeSingle(),
    supabase.from('patient_intake').select('chief, onset, current, history, meds, note').eq('patient_id', pid).maybeSingle(),
    supabase.from('problem').select('title, category, status, detail').eq('patient_id', pid).is('deleted_at', null).order('sort_order'),
  ]);
  const patient = (patRes.data as { name: string; kana: string | null; dob: string | null; sex: string | null; blood_type: string | null } | null) ?? { name: ctx.patient.name ?? 'あなた' };
  const cover = (coverRes.data as Record<string, string | null> | null) ?? null;
  const intake = (intakeRes.data as Record<string, string | null> | null) ?? null;
  const problems = (problemsRes.data ?? []) as { title: string; category: string | null; status: string; detail: string | null }[];

  const empty = !cover && !intake && !problems.length;

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>カルテ</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/mypage">‹ マイページ</Link></p>
        <p className="meta">先生が記入したあなたの基本カルテです（閲覧のみ）。</p>
        <BasicKarte data={{ patient, cover, intake, problems }} />
        {empty ? <div className="empty">まだ先生の記入はありません</div> : null}
      </div>
    </>
  );
}
