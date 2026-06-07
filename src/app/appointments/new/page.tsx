import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Topbar } from '@/components/Topbar';
import { AppointmentForm } from '../AppointmentForm';
import { listLocations } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewAppointmentPage({ searchParams }: { searchParams: { patientId?: string } }) {
  if (!isSupabaseConfigured()) redirect('/patients');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('patient').select('id, name').is('deleted_at', null).order('name');
  const patients = (data ?? []) as { id: string; name: string }[];
  const locations = await listLocations();

  return (
    <>
      <Topbar userEmail={user.email} />
      <div className="container">
        <p className="meta"><Link href="/appointments">‹ 予約一覧</Link></p>
        <AppointmentForm patients={patients} locations={locations} defaultPatientId={searchParams.patientId} />
      </div>
    </>
  );
}
