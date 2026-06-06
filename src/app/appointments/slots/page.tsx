import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { SlotForm } from './SlotForm';
import { GenerateForm } from './GenerateForm';
import { toggleSlot, deleteSlot } from '../actions';
import { fmtJst, fmtTimeJst } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

interface Slot { id: string; start_at: string; end_at: string; is_blocked: boolean; google_event_id: string | null }

export default async function SlotsPage() {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('appointment_slots')
    .select('id, start_at, end_at, is_blocked, google_event_id')
    .gte('start_at', nowIso)
    .order('start_at', { ascending: true })
    .limit(100);
  const slots = (data ?? []) as Slot[];

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta"><Link href="/appointments">‹ 予約一覧</Link></p>
        <GenerateForm />
        <SlotForm />
        <div className="card">
          <h2>今後の空き枠</h2>
          {slots.length ? (
            <ul className="patient-list">
              {slots.map((s) => (
                <li key={s.id}>
                  <div style={{ padding: '8px 4px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span>
                      {fmtJst(s.start_at)}–{fmtTimeJst(s.end_at)}
                      {s.is_blocked ? <span className="tag" style={{ marginLeft: 8 }}>受付不可</span> : <span className="meta">　受付中</span>}
                      {s.google_event_id ? <span className="meta">　(Google)</span> : null}
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
          ) : <div className="empty">空き枠がありません</div>}
        </div>
      </div>
    </>
  );
}
