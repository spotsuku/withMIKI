import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { createClient } from '@/lib/supabase/server';
import { DailyForm, type DailyInitial } from './DailyForm';

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

  // 当日の既存記録を読み込み
  const supabase = createClient();
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

  const d = (daily as Record<string, unknown> | null) ?? {};
  const initial: DailyInitial = {
    record_date: today,
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
        <p className="meta">{ctx.patient.name} さん　毎日の体調を記録しましょう。</p>
        <DailyForm initial={initial} />
      </div>
    </>
  );
}
