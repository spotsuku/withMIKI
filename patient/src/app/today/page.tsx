import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { createClient } from '@/lib/supabase/server';
import { DailyForm, type DailyInitial } from './DailyForm';
import { AthleteForm, type AthleteInitial } from './AthleteForm';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container">
        <div className="notice">
          Supabase が未設定です。<code>.env.local</code> に
          <code>NEXT_PUBLIC_SUPABASE_URL</code> /
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> を設定してください。
        </div>
      </div>
    );
  }

  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');

  const today = new Date().toISOString().slice(0, 10);

  if (!ctx.patient) {
    return (
      <>
        <div className="topbar">
          <span className="brand">WithMIKI<small>記録</small></span>
          <form action="/auth/signout" method="post">
            <button className="btn secondary" type="submit">ログアウト</button>
          </form>
        </div>
        <div className="container">
          <div className="notice">
            このアカウントはまだ患者情報にひも付いていません。担当の先生にご連絡ください。
          </div>
        </div>
      </>
    );
  }

  const supabase = createClient();

  // プログラム種別を判定（婦人科 / アスリート）
  const { data: prog } = await supabase
    .from('patient_program')
    .select('is_primary, care_program:care_program_id(record_kind)')
    .eq('patient_id', ctx.patient.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();
  const cp = (prog as { care_program: { record_kind: string } | { record_kind: string }[] | null } | null)?.care_program;
  const recordKind = (Array.isArray(cp) ? cp[0]?.record_kind : cp?.record_kind) ?? 'gyneco';

  // ===== アスリート =====
  if (recordKind === 'athlete') {
    const { data: aDaily } = await supabase
      .from('daily_record')
      .select('id, weight, body_fat, muscle_mass, hr, sleep_hours, condition, memo')
      .eq('patient_id', ctx.patient.id)
      .eq('record_date', today)
      .is('deleted_at', null)
      .maybeSingle();
    let aExt: Record<string, unknown> | null = null;
    if (aDaily) {
      const { data } = await supabase.from('athlete_daily').select('injury').eq('daily_record_id', (aDaily as { id: string }).id).maybeSingle();
      aExt = (data as Record<string, unknown> | null) ?? null;
    }
    const { data: trainings } = await supabase
      .from('training_session')
      .select('type, duration_min, intensity, memo')
      .eq('patient_id', ctx.patient.id)
      .eq('session_date', today);
    const ad = (aDaily as Record<string, unknown> | null) ?? {};
    const aInitial: AthleteInitial = {
      record_date: today,
      weight: (ad.weight as number) ?? null,
      body_fat: (ad.body_fat as number) ?? null,
      muscle_mass: (ad.muscle_mass as number) ?? null,
      hr: (ad.hr as number) ?? null,
      sleep_hours: (ad.sleep_hours as number) ?? null,
      condition: (ad.condition as string) ?? null,
      injury: (aExt?.injury as string) ?? null,
      memo: (ad.memo as string) ?? null,
      trainings: (trainings ?? []) as AthleteInitial['trainings'],
    };
    return (
      <>
        <div className="topbar">
          <span className="brand">WithMIKI<small>記録</small></span>
          <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
        </div>
        <div className="container">
          <h1 style={{ fontSize: '1.3rem' }}>今日の記録 <span className="meta">{today}</span></h1>
          <p className="meta">{ctx.patient.name} さん（アスリート）　<Link href="/food">🍱 食事</Link>　<Link href="/history">📈 推移</Link>　<Link href="/labs">🩸 採血</Link>　<Link href="/media">📷 写真</Link></p>
          <AthleteForm initial={aInitial} />
        </div>
      </>
    );
  }

  // ===== 婦人科（既定） =====
  const { data: daily } = await supabase
    .from('daily_record')
    .select('id, weight, body_fat, body_temp, sleep_hours, water, memo, payload')
    .eq('patient_id', ctx.patient.id)
    .eq('record_date', today)
    .is('deleted_at', null)
    .maybeSingle();

  let gyneco: Record<string, unknown> | null = null;
  if (daily) {
    const { data } = await supabase
      .from('gyneco_daily')
      .select('*')
      .eq('daily_record_id', (daily as { id: string }).id)
      .maybeSingle();
    gyneco = (data as Record<string, unknown> | null) ?? null;
  }

  // セルフケア・服薬の既存値
  let selfcare: string[] = [];
  let meds: string[] = [];
  if (daily) {
    const did = (daily as { id: string }).id;
    const { data: sc } = await supabase.from('selfcare_log').select('selfcare_code, done').eq('daily_record_id', did);
    selfcare = ((sc ?? []) as { selfcare_code: string; done: boolean }[]).filter((r) => r.done).map((r) => r.selfcare_code);
    const { data: ml } = await supabase
      .from('medication_log')
      .select('taken, medication:medication_id(name)')
      .eq('daily_record_id', did);
    meds = ((ml ?? []) as { taken: boolean; medication: { name: string } | { name: string }[] | null }[])
      .filter((r) => r.taken)
      .map((r) => (Array.isArray(r.medication) ? r.medication[0]?.name : r.medication?.name))
      .filter((x): x is string => !!x);
  }

  const d = (daily as Record<string, unknown> | null) ?? {};
  const initial: DailyInitial = {
    record_date: today,
    selfcare,
    meds,
    weight: (d.weight as number) ?? null,
    body_fat: (d.body_fat as number) ?? null,
    body_temp: (d.body_temp as number) ?? null,
    sleep_hours: (d.sleep_hours as number) ?? null,
    water: (d.water as number) ?? null,
    memo: (d.memo as string) ?? null,
    bbt: (gyneco?.bbt as number) ?? null,
    pain: (gyneco?.pain as number) ?? null,
    gyneco: gyneco ?? {},
    payload: (d.payload as Record<string, unknown>) ?? {},
  };

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>記録</small></span>
        <form action="/auth/signout" method="post">
          <button className="btn secondary" type="submit">ログアウト</button>
        </form>
      </div>
      <div className="container">
        <h1 style={{ fontSize: '1.3rem' }}>
          今日の記録 <span className="meta">{today}</span>
        </h1>
        <p className="meta">{ctx.patient.name} さん　毎日の体調を記録しましょう。　<Link href="/food">🍱 食事</Link>　<Link href="/history">📈 推移</Link>　<Link href="/labs">🩸 採血</Link>　<Link href="/media">📷 写真</Link></p>
        <DailyForm initial={initial} />
      </div>
    </>
  );
}
