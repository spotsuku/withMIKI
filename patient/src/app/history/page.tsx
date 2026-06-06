import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { TrendChart, type Series } from '@/components/TrendChart';
import { CalendarMonth } from '@/components/CalendarMonth';

export const dynamic = 'force-dynamic';

interface DRow { record_date: string; weight: number | null; body_fat: number | null; hr: number | null }
interface GRow { bbt: number | null; pain: number | null; menstrual: string | null; daily_record: { record_date: string } | { record_date: string }[] | null }

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function pickDate(r: GRow): string {
  const dr = r.daily_record;
  return (Array.isArray(dr) ? dr[0]?.record_date : dr?.record_date) ?? '';
}

export default async function HistoryPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const supabase = createClient();
  const { data: drs } = await supabase
    .from('daily_record')
    .select('record_date, weight, body_fat, hr')
    .eq('patient_id', ctx.patient.id)
    .is('deleted_at', null)
    .order('record_date', { ascending: true })
    .limit(120);
  const { data: grs } = await supabase
    .from('gyneco_daily')
    .select('bbt, pain, menstrual, daily_record:daily_record_id(record_date)')
    .limit(200);

  const dRows = (drs ?? []) as DRow[];
  const gRows = ((grs ?? []) as GRow[])
    .map((r) => ({ date: pickDate(r), bbt: r.bbt, pain: r.pain, menstrual: r.menstrual }))
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ===== 周期予測 =====
  const periodStarts: string[] = [];
  let prev: string | null = null;
  for (const r of gRows) {
    if (r.menstrual === 'period') {
      if (!prev || Math.round((new Date(r.date).getTime() - new Date(prev).getTime()) / 86400000) > 1) {
        periodStarts.push(r.date);
      }
      prev = r.date;
    }
  }
  let avgCycle: number | null = null;
  let nextPeriod: string | null = null;
  let nextOvulation: string | null = null;
  if (periodStarts.length >= 2) {
    let sum = 0;
    for (let i = 1; i < periodStarts.length; i++) {
      sum += Math.round((new Date(periodStarts[i]).getTime() - new Date(periodStarts[i - 1]).getTime()) / 86400000);
    }
    avgCycle = Math.round(sum / (periodStarts.length - 1));
    if (avgCycle > 0 && avgCycle < 90) {
      nextPeriod = addDays(periodStarts[periodStarts.length - 1], avgCycle);
      nextOvulation = addDays(nextPeriod, -14);
    }
  }

  const periodDates = new Set(gRows.filter((r) => r.menstrual === 'period').map((r) => r.date));
  const recordDates = new Set([...gRows.map((r) => r.date), ...dRows.map((r) => r.record_date)]);
  const now = new Date();

  const mk = (pts: { date: string; v: number | null }[], name: string, color: string): Series => ({
    name, color, points: pts.filter((p) => p.v != null).map((p) => ({ label: p.date.slice(5), value: p.v as number })),
  });

  const bbt = mk(gRows.map((r) => ({ date: r.date, v: r.bbt })), '基礎体温', '#c0392b');
  const pain = mk(gRows.map((r) => ({ date: r.date, v: r.pain })), '痛み', '#8a6d3b');
  const weight = mk(dRows.map((r) => ({ date: r.record_date, v: r.weight })), '体重', '#8a6d3b');
  const bodyfat = mk(dRows.map((r) => ({ date: r.record_date, v: r.body_fat })), '体脂肪', '#1d6fb8');
  const hr = mk(dRows.map((r) => ({ date: r.record_date, v: r.hr })), '安静時心拍', '#2a9d4a');

  const charts: { title: string; unit?: string; series: Series[] }[] = [];
  if (bbt.points.length) charts.push({ title: '基礎体温の推移', unit: '℃', series: [bbt] });
  if (weight.points.length) charts.push({ title: '体重の推移', unit: 'kg', series: [weight] });
  if (bodyfat.points.length) charts.push({ title: '体脂肪の推移', unit: '%', series: [bodyfat] });
  if (pain.points.length) charts.push({ title: '痛みの推移', series: [pain] });
  if (hr.points.length) charts.push({ title: '安静時心拍の推移', unit: 'bpm', series: [hr] });

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>記録</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/today">‹ 今日の記録</Link></p>
        <h1 style={{ fontSize: '1.3rem' }}>推移・周期</h1>

        {/* 周期予測 */}
        {periodStarts.length >= 2 ? (
          <div className="card">
            <h2>周期予測</h2>
            <dl className="kv">
              <dt>平均周期</dt><dd>{avgCycle} 日</dd>
              {nextPeriod ? (<><dt>次の月経（予測）</dt><dd>{nextPeriod}</dd></>) : null}
              {nextOvulation ? (<><dt>次の排卵（予測）</dt><dd>{nextOvulation}</dd></>) : null}
            </dl>
            <p className="meta">※ 過去の月経開始日からの簡易予測です。</p>
          </div>
        ) : null}

        {/* カレンダー */}
        <CalendarMonth
          year={now.getFullYear()}
          month={now.getMonth()}
          recordDates={recordDates}
          periodDates={periodDates}
          predictedPeriod={nextPeriod}
          predictedOvulation={nextOvulation}
        />

        {charts.length ? charts.map((c) => <TrendChart key={c.title} title={c.title} unit={c.unit} series={c.series} />)
          : <div className="card"><div className="empty">記録がたまるとグラフが表示されます。</div></div>}
      </div>
    </>
  );
}
