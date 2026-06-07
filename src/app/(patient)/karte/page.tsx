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

  // 先生→患者の公開設定（既定は全公開）
  const { data: visRows } = await supabase.from('karte_visibility').select('section, visible').eq('patient_id', pid);
  const visible: Record<string, boolean> = {};
  for (const r of (visRows ?? []) as { section: string; visible: boolean }[]) visible[r.section] = r.visible;
  const vis = (k: string) => visible[k] ?? true;

  const [patRes, coverRes, intakeRes, problemsRes, visitsRes, labsRes] = await Promise.all([
    supabase.from('patient').select('name, kana, dob, sex, blood_type').eq('id', pid).maybeSingle(),
    vis('careplan') ? supabase.from('karte_cover').select('*').eq('patient_id', pid).maybeSingle() : Promise.resolve({ data: null }),
    vis('intake') ? supabase.from('patient_intake').select('*').eq('patient_id', pid).maybeSingle() : Promise.resolve({ data: null }),
    vis('problems') ? supabase.from('problem').select('title, category, status, detail').eq('patient_id', pid).is('deleted_at', null).order('sort_order') : Promise.resolve({ data: [] }),
    vis('visits') ? supabase.from('visit').select('visit_date, injury_part, injury_name, treatments, memo').eq('patient_id', pid).is('deleted_at', null).order('visit_date', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    vis('labs') ? supabase.from('lab_result').select('taken_date, comment').eq('patient_id', pid).is('deleted_at', null).order('taken_date', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const patient = (patRes.data as { name: string; kana: string | null; dob: string | null; sex: string | null; blood_type: string | null } | null) ?? { name: ctx.patient.name ?? 'あなた' };
  const cover = (coverRes.data as Record<string, string | null> | null) ?? null;
  const intake = (intakeRes.data as Record<string, string | null> | null) ?? null;
  const problems = (problemsRes.data ?? []) as { title: string; category: string | null; status: string; detail: string | null }[];
  const visits = (visitsRes.data ?? []) as { visit_date: string; injury_part: string | null; injury_name: string | null; treatments: string[] | null; memo: string | null }[];
  const labs = (labsRes.data ?? []) as { taken_date: string; comment: string | null }[];

  const empty = !cover && !intake && !problems.length && !visits.length && !labs.length;

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>カルテ</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/mypage">‹ マイページ</Link></p>
        <p className="meta">先生が記入し、公開したあなたの基本カルテです（閲覧のみ）。</p>
        <BasicKarte data={{ patient, cover, intake, problems, visits, labs }} visible={visible} />
        {empty ? <div className="empty">公開されている内容はまだありません</div> : null}
      </div>
    </>
  );
}
