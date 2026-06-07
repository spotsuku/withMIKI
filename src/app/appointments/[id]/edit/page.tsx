import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { AppointmentForm, type ApptInitial } from '../../AppointmentForm';
import { listLocations } from '../../actions';
import { isoDateJst, isoTimeJst, diffMinutes } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

export default async function EditAppointmentPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [apptRes, patRes, locations] = await Promise.all([
    supabase.from('appointments').select('id, patient_id, title, location, start_at, end_at, status, notes').eq('id', params.id).maybeSingle(),
    supabase.from('patient').select('id, name').is('deleted_at', null).order('name'),
    listLocations(),
  ]);
  if (!apptRes.data) notFound();
  const a = apptRes.data as { id: string; patient_id: string | null; title: string | null; location: string | null; start_at: string; end_at: string; status: string; notes: string | null };
  const patients = (patRes.data ?? []) as { id: string; name: string }[];

  const initial: ApptInitial = {
    id: a.id,
    patient_id: a.patient_id,
    title: a.title,
    location: a.location,
    date: isoDateJst(a.start_at),
    time: isoTimeJst(a.start_at),
    duration: diffMinutes(a.start_at, a.end_at),
    status: a.status,
    notes: a.notes,
  };

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta"><Link href="/appointments">‹ 予約一覧</Link></p>
        <AppointmentForm patients={patients} locations={locations} initial={initial} />
      </div>
    </>
  );
}
