import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';

/** ログイン中の患者の主プログラムを判定し、婦人科ならピンクテーマを適用 */
async function resolveTheme(): Promise<string> {
  if (!isSupabaseConfigured()) return '';
  try {
    const ctx = await getPatientContext();
    if (!ctx?.patient) return '';
    const supabase = createClient();
    const { data } = await supabase
      .from('patient_program')
      .select('is_primary, care_program:care_program_id(record_kind)')
      .eq('patient_id', ctx.patient.id)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();
    const cp = (data as { care_program: { record_kind: string } | { record_kind: string }[] | null } | null)?.care_program;
    const kind = (Array.isArray(cp) ? cp[0]?.record_kind : cp?.record_kind) ?? 'gyneco';
    return kind === 'athlete' ? '' : 'theme-gyneco';
  } catch {
    return '';
  }
}

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const themeClass = await resolveTheme();
  return <div className={themeClass}>{children}</div>;
}
