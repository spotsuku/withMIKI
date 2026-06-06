'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveBodyDiagram, type BodyFormState } from './actions';

interface Mark {
  x: number; // 0..1
  y: number; // 0..1
  color: string;
}

const W = 280;
const H = 420;
const COLORS = ['#e63946', '#1d6fb8', '#2a9d4a', '#e8920c', '#333333'];
const COLOR_LABELS: Record<string, string> = {
  '#e63946': '痛み',
  '#1d6fb8': 'こり',
  '#2a9d4a': '施術点',
  '#e8920c': '注意',
  '#333333': 'その他',
};

/** 簡易の人体シルエットを描画 */
function drawBody(ctx: CanvasRenderingContext2D, view: 'front' | 'back') {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#faf8f4';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#bbb6ad';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#f0ece4';
  const cx = W / 2;

  // 頭
  ctx.beginPath();
  ctx.arc(cx, 50, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 胴体
  ctx.beginPath();
  ctx.moveTo(cx - 38, 90);
  ctx.lineTo(cx + 38, 90);
  ctx.lineTo(cx + 30, 230);
  ctx.lineTo(cx - 30, 230);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 腕
  ctx.beginPath();
  ctx.moveTo(cx - 38, 95); ctx.lineTo(cx - 70, 200);
  ctx.moveTo(cx + 38, 95); ctx.lineTo(cx + 70, 200);
  // 脚
  ctx.moveTo(cx - 22, 230); ctx.lineTo(cx - 28, 390);
  ctx.moveTo(cx + 22, 230); ctx.lineTo(cx + 28, 390);
  ctx.stroke();

  ctx.fillStyle = '#999';
  ctx.font = '12px sans-serif';
  ctx.fillText(view === 'front' ? '前面' : '背面', 8, 18);
}

function redraw(canvas: HTMLCanvasElement, view: 'front' | 'back', marks: Mark[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawBody(ctx, view);
  for (const m of marks) {
    ctx.beginPath();
    ctx.arc(m.x * W, m.y * H, 7, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? '保存中…' : '保存'}
    </button>
  );
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
  const [state, formAction] = useFormState<BodyFormState, FormData>(saveBodyDiagram, {});

  useEffect(() => {
    if (canvasRef.current) redraw(canvasRef.current, view, marks);
  }, [marks, view]);

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMarks((prev) => [...prev, { x, y, color }]);
  }

  return (
    <div className="card">
      <h2>{view === 'front' ? '前面' : '背面'}</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            title={COLOR_LABELS[c]}
            style={{
              width: 28, height: 28, borderRadius: '50%', background: c,
              border: color === c ? '3px solid #333' : '2px solid #fff', cursor: 'pointer',
            }}
          />
        ))}
        <span className="meta" style={{ alignSelf: 'center' }}>{COLOR_LABELS[color]}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={onClick}
        style={{ width: W, maxWidth: '100%', border: '1px solid var(--line)', borderRadius: 8, cursor: 'crosshair', touchAction: 'none' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn secondary" onClick={() => setMarks((p) => p.slice(0, -1))}>
          1つ戻す
        </button>
        <button type="button" className="btn secondary" onClick={() => setMarks([])}>
          全消去
        </button>
      </div>

      <form action={formAction} style={{ marginTop: 12 }}>
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="marks" value={JSON.stringify(marks)} />
        <div className="field">
          <label>メモ</label>
          <textarea name="note" rows={2} defaultValue={initialNote} />
        </div>
        {state?.error ? <p className="error">{state.error}</p> : null}
        <SubmitButton />
      </form>
    </div>
  );
}
