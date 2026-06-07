import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { SlotCalendar, type SlotItem } from './SlotCalendar';
import { SlotForm } from './SlotForm';
import { TemplatePanel } from './TemplatePanel';
import { listTemplates, toggleSlot, deleteSlot } from '../actions';
import { jstToIso, weekDatesJst, fmtJst, fmtTimeJst } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

interface UpRow { id: string; start_at: string; end_at: string; is_blocked: boolean }

export default async function SlotsPage({ searchParams }: { searchParams: { w?: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const offset = parseInt(searchParams.w ?? '0', 10) || 0;
  const week = weekDatesJst(offset);
  const rangeStart = jstToIso(week[0], '00:00');
  const rangeEnd = jstToIso(week[6], '23:59');

  const { data, error: slotErr } = await supabase
    .from('appointment_slots')
    .select('id, start_at, end_at, is_blocked')
    .gte('start_at', rangeStart)
    .lte('start_at', rangeEnd)
    .order('start_at', { ascending: true });
  const slots = (data ?? []) as SlotItem[];
  const tableMissing = !!slotErr && /appointment_slots/.test(slotErr.message);

  // 今後の空き枠（週に関係なく一覧表示。追加結果が必ず見えるように）
  const { data: upData } = await supabase
    .from('appointment_slots')
    .select('id, start_at, end_at, is_blocked')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(60);
  const upcoming = (upData ?? []) as UpRow[];
  const templates = await listTemplates();

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta"><Link href="/appointments">‹ 予約一覧</Link></p>
        <h1 style={{ fontSize: '1.3rem' }}>空き枠の設定</h1>

        {tableMissing ? (
          <div className="notice">
            予約テーブルが未作成です。Supabase で <code>0011</code> を実行してください。
          </div>
        ) : null}

        {/* スマホでも確実：手動追加 */}
        <SlotForm />

        {/* 追加した空き枠の一覧（必ず見える） */}
        <div className="card">
          <h2>今後の空き枠（{upcoming.length}）</h2>
          {upcoming.length ? (
            <ul className="patient-list">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <div style={{ padding: '8px 4px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span>
                      {fmtJst(s.start_at)}–{fmtTimeJst(s.end_at)}
                      {s.is_blocked ? <span className="tag" style={{ marginLeft: 8 }}>受付不可</span> : <span className="meta">　受付中</span>}
                    </span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <form action={toggleSlot}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="blocked" value={s.is_blocked ? '0' : '1'} />
                        <button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12 }}>{s.is_blocked ? '受付可に' : 'ブロック'}</button>
                      </form>
                      <form action={deleteSlot}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn secondary" style={{ padding: '2px 8px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}>削除</button>
                      </form>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="empty">まだありません。上のフォームから追加してください。</div>}
        </div>

        {/* カレンダー（PC・対応端末ではドラッグ/タップでも追加） */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
          <Link className="btn secondary" href={`/appointments/slots?w=${offset - 1}`}>‹ 前週</Link>
          <span className="meta">{week[0]} 〜 {week[6]}</span>
          <Link className="btn secondary" href={`/appointments/slots?w=${offset + 1}`}>翌週 ›</Link>
        </div>
        <SlotCalendar week={week} slots={slots} />

        <TemplatePanel templates={templates} />
      </div>
    </>
  );
}
