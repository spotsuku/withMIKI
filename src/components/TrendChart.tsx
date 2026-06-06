/** 依存ゼロの SVG 折れ線グラフ（サーバーコンポーネント）。複数系列対応。 */

export interface Series {
  name: string;
  color: string;
  points: { label: string; value: number }[];
}

export function TrendChart({
  title,
  unit,
  series,
}: {
  title: string;
  unit?: string;
  series: Series[];
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;

  const W = 600;
  const H = 180;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  // X 軸はラベルのユニーク順（時系列前提で渡される）
  const labels = Array.from(new Set(all.map((p) => p.label)));
  const xOf = (label: string) => {
    const idx = labels.indexOf(label);
    return pad.l + (labels.length <= 1 ? innerW / 2 : (idx / (labels.length - 1)) * innerW);
  };

  const min = Math.min(...all.map((p) => p.value));
  const max = Math.max(...all.map((p) => p.value));
  const range = max - min || 1;
  const yOf = (v: number) => pad.t + innerH - ((v - min) / range) * innerH;

  return (
    <div className="card">
      <h2>
        {title}
        {unit ? <span className="meta">（{unit}）</span> : null}
      </h2>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={title}>
        {/* 軸 */}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="#ddd" />
        <line x1={pad.l} y1={pad.t + innerH} x2={pad.l + innerW} y2={pad.t + innerH} stroke="#ddd" />
        {/* y 目盛 */}
        <text x={4} y={pad.t + 4} fontSize="10" fill="#999">{max.toFixed(1)}</text>
        <text x={4} y={pad.t + innerH} fontSize="10" fill="#999">{min.toFixed(1)}</text>
        {series.map((s) => {
          const pts = s.points.filter((p) => Number.isFinite(p.value));
          if (pts.length === 0) return null;
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.label).toFixed(1)} ${yOf(p.value).toFixed(1)}`).join(' ');
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" />
              {pts.map((p, i) => (
                <circle key={i} cx={xOf(p.label)} cy={yOf(p.value)} r="3" fill={s.color} />
              ))}
            </g>
          );
        })}
        {/* x ラベル（端のみ） */}
        {labels.length > 0 ? (
          <>
            <text x={pad.l} y={H - 6} fontSize="10" fill="#999">{labels[0]}</text>
            <text x={pad.l + innerW} y={H - 6} fontSize="10" fill="#999" textAnchor="end">
              {labels[labels.length - 1]}
            </text>
          </>
        ) : null}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
        {series.map((s) => (
          <span key={s.name} className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 3, background: s.color, display: 'inline-block' }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
