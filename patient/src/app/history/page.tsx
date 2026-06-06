import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { TrendChart, type Series } from '@/components/TrendChart';

export const dynamic = 'force-dynamic';

interface DRow { record_date: string; weight: number | null; body_fat: number | null; hr: number | null }
interface GRow { bbt: number | null; pain: number | null; daily_record: { record_date: string } | { record_date: string }[] | null }

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
    .select('bbt, pain, daily_record:daily_record_id(record_date)')
    .limit(120);

  const dRows = (drs ?? []) as DRow[];
  const gRows = ((grs ?? []) as GRow[])
    .map((r) => ({ date: pickDate(r), bbt: r.bbt, pain: r.pain }))
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

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
        <h1 style={{ fontSize: '1.3rem' }}>推移グラフ</h1>
        {charts.length ? charts.map((c) => <TrendChart key={c.title} title={c.title} unit={c.unit} series={c.series} />)
          : <div className="card"><div className="empty">記録がたまるとグラフが表示されます。</div></div>}
      </div>
    </>
  );
}
