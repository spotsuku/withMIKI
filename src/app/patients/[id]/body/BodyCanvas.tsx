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

/** タップ可能な人体シルエット（前面/背面）を描画 */
function drawBody(ctx: CanvasRenderingContext2D, view: 'front' | 'back') {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fafbfe';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const skin = '#eef1f7';
  const line = '#9aa3b2';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = skin;

  // 先に手足（体の下層）
  // 腕（肩→手）: 軽く外側へ。テーパー付き
  limb(ctx, cx - 40, 96, 14, 168, 19, 11);
  limb(ctx, cx + 40, 96, -14, 168, 19, 11);
  // 手
  ellipse(ctx, cx - 40 - Math.sin(14 * D) * 168 - 2, 96 + Math.cos(14 * D) * 168, 8, 11);
  ellipse(ctx, cx + 40 + Math.sin(14 * D) * 168 + 2, 96 + Math.cos(14 * D) * 168, 8, 11);
  // 脚（股→足）
  limb(ctx, cx - 17, 250, 4, 150, 25, 15);
  limb(ctx, cx + 17, 250, -4, 150, 25, 15);
  // 足
  ellipse(ctx, cx - 20, 404, 11, 9);
  ellipse(ctx, cx + 20, 404, 11, 9);

  // 胴体（肩→ウエスト→骨盤）
  ctx.beginPath();
  ctx.moveTo(cx - 44, 92);
  ctx.quadraticCurveTo(cx - 50, 96, cx - 46, 104);     // 肩
  ctx.lineTo(cx - 30, 150);
  ctx.quadraticCurveTo(cx - 26, 178, cx - 30, 196);    // ウエスト
  ctx.quadraticCurveTo(cx - 44, 232, cx - 40, 256);    // 骨盤
  ctx.lineTo(cx + 40, 256);
  ctx.quadraticCurveTo(cx + 44, 232, cx + 30, 196);
  ctx.quadraticCurveTo(cx + 26, 178, cx + 30, 150);
  ctx.lineTo(cx + 46, 104);
  ctx.quadraticCurveTo(cx + 50, 96, cx + 44, 92);      // 肩
  ctx.quadraticCurveTo(cx, 80, cx - 44, 92);           // 鎖骨ライン
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 首
  ctx.beginPath();
  ctx.moveTo(cx - 9, 84); ctx.lineTo(cx - 9, 70);
  ctx.lineTo(cx + 9, 70); ctx.lineTo(cx + 9, 84);
  ctx.fill(); ctx.stroke();

  // 頭
  ctx.beginPath();
  ctx.ellipse(cx, 48, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // 詳細ライン
  ctx.strokeStyle = '#c2c9d6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (view === 'front') {
    // 体の中心線・胸郭・腹直筋の目安
    ctx.moveTo(cx, 96); ctx.lineTo(cx, 250);
    ctx.moveTo(cx - 22, 120); ctx.quadraticCurveTo(cx, 132, cx + 22, 120); // 胸下
    ctx.moveTo(cx - 16, 196); ctx.lineTo(cx + 16, 196); // ウエスト
  } else {
    // 背面：脊柱・肩甲骨・臀部
    ctx.moveTo(cx, 92); ctx.lineTo(cx, 256);
    ctx.moveTo(cx - 26, 110); ctx.quadraticCurveTo(cx - 14, 120, cx - 18, 138); // 左肩甲骨
    ctx.moveTo(cx + 26, 110); ctx.quadraticCurveTo(cx + 14, 120, cx + 18, 138); // 右肩甲骨
    ctx.moveTo(cx - 30, 232); ctx.quadraticCurveTo(cx, 244, cx + 30, 232);      // 臀裂上
  }
  ctx.stroke();

  ctx.fillStyle = '#94a0b5';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(view === 'front' ? '前面' : '背面', 8, 18);
}

const D = Math.PI / 180;

/** 端ほど細くなる四肢（x,y=付け根、angleDeg=外向き角度、len=長さ） */
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
