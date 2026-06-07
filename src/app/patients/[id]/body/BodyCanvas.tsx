'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveBodyDiagram, type BodyFormState } from './actions';

interface Mark {
  x: number; // 0..1
  y: number; // 0..1
  color: string;
  size?: number; // px 半径
}

const W = 280;
const H = 607; // 人体図画像(852×1846)の縦横比に合わせる

const COLORS = ['#e63946', '#f08c00', '#1d6fb8', '#2a9d4a', '#7048e8'];
const COLOR_LABELS: Record<string, string> = {
  '#e63946': '痛み・急性症状',
  '#f08c00': '違和感・慢性症状',
  '#1d6fb8': '施術ポイント・鍼穴',
  '#2a9d4a': '改善・経過良好',
  '#7048e8': 'その他・要観察',
};
const SIZES: [string, number][] = [['小', 6], ['中', 10], ['大', 16]];

const D = Math.PI / 180;

function drawBody(ctx: CanvasRenderingContext2D, view: 'front' | 'back') {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const skin = '#f1f4fa';
  const line = '#9aa3b2';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = skin;

  limb(ctx, cx - 40, 96, 14, 168, 19, 11);
  limb(ctx, cx + 40, 96, -14, 168, 19, 11);
  ellipse(ctx, cx - 40 - Math.sin(14 * D) * 168 - 2, 96 + Math.cos(14 * D) * 168, 8, 11);
  ellipse(ctx, cx + 40 + Math.sin(14 * D) * 168 + 2, 96 + Math.cos(14 * D) * 168, 8, 11);
  limb(ctx, cx - 17, 250, 4, 150, 25, 15);
  limb(ctx, cx + 17, 250, -4, 150, 25, 15);
  ellipse(ctx, cx - 20, 404, 11, 9);
  ellipse(ctx, cx + 20, 404, 11, 9);

  ctx.beginPath();
  ctx.moveTo(cx - 44, 92);
  ctx.quadraticCurveTo(cx - 50, 96, cx - 46, 104);
  ctx.lineTo(cx - 30, 150);
  ctx.quadraticCurveTo(cx - 26, 178, cx - 30, 196);
  ctx.quadraticCurveTo(cx - 44, 232, cx - 40, 256);
  ctx.lineTo(cx + 40, 256);
  ctx.quadraticCurveTo(cx + 44, 232, cx + 30, 196);
  ctx.quadraticCurveTo(cx + 26, 178, cx + 30, 150);
  ctx.lineTo(cx + 46, 104);
  ctx.quadraticCurveTo(cx + 50, 96, cx + 44, 92);
  ctx.quadraticCurveTo(cx, 80, cx - 44, 92);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 9, 84); ctx.lineTo(cx - 9, 70);
  ctx.lineTo(cx + 9, 70); ctx.lineTo(cx + 9, 84);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, 48, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = '#c2c9d6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (view === 'front') {
    ctx.moveTo(cx, 96); ctx.lineTo(cx, 250);
    ctx.moveTo(cx - 22, 120); ctx.quadraticCurveTo(cx, 132, cx + 22, 120);
    ctx.moveTo(cx - 16, 196); ctx.lineTo(cx + 16, 196);
  } else {
    ctx.moveTo(cx, 92); ctx.lineTo(cx, 256);
    ctx.moveTo(cx - 26, 110); ctx.quadraticCurveTo(cx - 14, 120, cx - 18, 138);
    ctx.moveTo(cx + 26, 110); ctx.quadraticCurveTo(cx + 14, 120, cx + 18, 138);
    ctx.moveTo(cx - 30, 232); ctx.quadraticCurveTo(cx, 244, cx + 30, 232);
  }
  ctx.stroke();
}

function limb(ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number, len: number, wTop: number, wBot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleDeg * D);
  ctx.beginPath();
  ctx.moveTo(-wTop / 2, 0);
  ctx.lineTo(wTop / 2, 0);
  ctx.quadraticCurveTo(wBot / 2 + 1, len / 2, wBot / 2, len);
  ctx.quadraticCurveTo(0, len + 5, -wBot / 2, len);
  ctx.quadraticCurveTo(-wBot / 2 - 1, len / 2, -wTop / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function redraw(canvas: HTMLCanvasElement, view: 'front' | 'back', marks: Mark[], bg?: HTMLImageElement | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (bg && bg.complete && bg.naturalWidth > 0) {
    // 用意された人体図画像（public/body-front.png / body-back.png）を背景に使う
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    drawBody(ctx, view);
  }
  for (const m of marks) {
    ctx.beginPath();
    ctx.arc(m.x * W, m.y * H, m.size ?? 10, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? '保存中…' : 'マークを保存'}</button>;
}

export function BodyCanvas({
  patientId,
  view,
  initialMarks,
  initialNote,
}: {
  patientId: string;
  view: 'front' | 'back';
  initialMarks: Mark[];
  initialNote: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [marks, setMarks] = useState<Mark[]>(initialMarks);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(10);
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [state, formAction] = useFormState<BodyFormState, FormData>(saveBodyDiagram, {});

  // 人体図画像（public/body-front.png / body-back.png）があれば読み込んで使う
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBg(img);
    img.onerror = () => setBg(null);
    img.src = `/body-${view}.png`;
  }, [view]);

  useEffect(() => {
    if (canvasRef.current) redraw(canvasRef.current, view, marks, bg);
  }, [marks, view, bg]);

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMarks((prev) => [...prev, { x, y, color, size }]);
  }

  function saveImage() {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `bodychart-${view}.png`;
    a.click();
  }

  return (
    <div className="card">
      <h2>{view === 'front' ? '▼ 前面' : '▼ 背面'}</h2>

      {/* マーク色 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="meta">マーク色：</span>
        {COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} title={COLOR_LABELS[c]}
            style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: color === c ? '3px solid #1f2733' : '2px solid #fff', cursor: 'pointer', boxShadow: '0 0 0 1px var(--line)' }} />
        ))}
      </div>

      {/* マークサイズ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="meta">マークサイズ：</span>
        {SIZES.map(([label, r]) => (
          <button key={label} type="button" className={'chip' + (size === r ? ' on' : '')} onClick={() => setSize(r)}>{label}</button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onDown}
        style={{ width: W, maxWidth: '100%', border: '1px solid var(--line)', borderRadius: 10, cursor: 'crosshair', touchAction: 'none', background: '#fff' }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn secondary" onClick={() => setMarks((p) => p.slice(0, -1))}>↩ 1つ戻す</button>
        <button type="button" className="btn secondary" onClick={() => setMarks([])} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>全消去</button>
        <button type="button" className="btn secondary" onClick={saveImage}>🖼 画像として保存</button>
      </div>

      <form action={formAction} style={{ marginTop: 12 }}>
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="marks" value={JSON.stringify(marks)} />
        <div className="field">
          <label>📝 部位メモ</label>
          <textarea name="note" rows={2} defaultValue={initialNote} placeholder="治療した部位・メモ（例：右肩甲骨下・SP6・BL23など）…" />
        </div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <SubmitButton />
      </form>
    </div>
  );
}

export { COLORS, COLOR_LABELS };
