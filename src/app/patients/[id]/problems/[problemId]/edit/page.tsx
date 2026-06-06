import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { ProblemForm, type ProblemInitial } from '../../ProblemForm';
import { SoapAddForm } from '../../SoapAddForm';
import { deleteProblem, deleteSoap } from '../../actions';
import type { Patient } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SoapRow {
  id: string;
  note_date: string;
  s: string | null;
  o: string | null;
  a: string | null;
  p: string | null;
}

export default async function EditProblemPage({
  params,
}: {
  params: { id: string; problemId: string };
}) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [patientRes, problemRes, soapsRes] = await Promise.all([
    supabase.from('patient').select('id, name').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    supabase.from('problem').select('*').eq('id', params.problemId).is('deleted_at', null).maybeSingle(),
    supabase
      .from('soap_note')
      .select('id, note_date, s, o, a, p')
      .eq('problem_id', params.problemId)
      .order('note_date', { ascending: false }),
  ]);

  if (!patientRes.data || !problemRes.data) notFound();
  const p = patientRes.data as Pick<Patient, 'id' | 'name'>;
  const problem = problemRes.data as Record<string, unknown>;
  const soaps = (soapsRes.data ?? []) as SoapRow[];

  const initial: ProblemInitial = {
    id: problem.id as string,
    title: problem.title as string | null,
    category: problem.category as string | null,
    diagnosis: problem.diagnosis as string | null,
    onset: problem.onset as string | null,
    detail: problem.detail as string | null,
    status: problem.status as string | null,
  };

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta">
          <Link href={`/patients/${p.id}`}>‹ {p.name} のカルテ</Link>
        </p>

        <ProblemForm patientId={p.id} initial={initial} />

        {/* SOAP 履歴 */}
        <div className="card">
          <h2>SOAP 経過（{soaps.length}件）</h2>
          {soaps.length ? (
            <ul className="patient-list">
              {soaps.map((s) => (
                <li key={s.id}>
                  <div style={{ padding: '10px 4px', width: '100%' }}>
                    <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{s.note_date}</span>
                      <form action={deleteSoap}>
                        <input type="hidden" name="patientId" value={p.id} />
                        <input type="hidden" name="problemId" value={initial.id} />
                        <input type="hidden" name="soapId" value={s.id} />
                        <button
                          type="submit"
                          className="btn secondary"
                          style={{ padding: '2px 10px', fontSize: '.8rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                          削除
                        </button>
                      </form>
                    </div>
                    {s.s ? <div className="meta"><strong>S</strong> {s.s}</div> : null}
                    {s.o ? <div className="meta"><strong>O</strong> {s.o}</div> : null}
                    {s.a ? <div className="meta"><strong>A</strong> {s.a}</div> : null}
                    {s.p ? <div className="meta"><strong>P</strong> {s.p}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">SOAP 経過なし</div>
          )}
        </div>

        {/* SOAP 追加 */}
        <div className="card">
          <h2>SOAP を追加</h2>
          <SoapAddForm patientId={p.id} problemId={initial.id!} />
        </div>

        {/* 削除 */}
        <div className="card">
          <h2>削除</h2>
          <form action={deleteProblem}>
            <input type="hidden" name="patientId" value={p.id} />
            <input type="hidden" name="problemId" value={initial.id} />
            <button
              className="btn secondary"
              type="submit"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              この問題を削除
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
