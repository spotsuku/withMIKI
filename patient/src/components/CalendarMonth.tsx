/** 当月カレンダー（記録日・月経日・予測日をマーク）。サーバーコンポーネント。 */

export function CalendarMonth({
  year,
  month, // 0-11
  recordDates,
  periodDates,
  predictedPeriod,
  predictedOvulation,
}: {
  year: number;
  month: number;
  recordDates: Set<string>;
  periodDates: Set<string>;
  predictedPeriod?: string | null;
  predictedOvulation?: string | null;
}) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const iso = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const wd = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="card">
      <h2>{year}年{month + 1}月</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' }}>
        {wd.map((w) => <div key={w} className="meta" style={{ fontSize: 11 }}>{w}</div>)}
        {cells.map((d, idx) => {
          if (d === null) return <div key={idx} />;
          const day = iso(d);
          const isPeriod = periodDates.has(day);
          const hasRec = recordDates.has(day);
          const isPredP = day === predictedPeriod;
          const isPredO = day === predictedOvulation;
          let bg = 'transparent', color = 'var(--ink)', title = '';
          if (isPeriod) { bg = '#f8d7da'; color = '#c0392b'; title = '月経'; }
          else if (isPredP) { bg = 'repeating-linear-gradient(45deg,#fde,#fde 3px,#fff 3px,#fff 6px)'; color = '#c0392b'; title = '予測月経'; }
          else if (isPredO) { bg = '#dfeffd'; color = '#1d6fb8'; title = '予測排卵'; }
          return (
            <div key={idx} title={title} style={{
              padding: '6px 0', borderRadius: 8, background: bg, color,
              fontWeight: isPeriod || isPredP || isPredO ? 600 : 400, position: 'relative',
            }}>
              {d}
              {hasRec ? <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        <span className="meta">🔴 月経　〰 予測月経　🔵 予測排卵　・記録あり</span>
      </div>
    </div>
  );
}
