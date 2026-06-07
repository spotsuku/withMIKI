import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { listDiary } from '@/lib/diaryCore';
import { DiaryClient } from './DiaryClient';

export const dynamic = 'force-dynamic';

export default async function DiaryPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');
  if (!ctx.patient) redirect('/today');

  const entries = await listDiary(createClient(), ctx.patient.id);

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>日記</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <p className="meta"><Link href="/mypage">‹ マイページ</Link></p>
        <p className="meta">日記は<strong>既定で非公開</strong>です。先生に見てほしいものだけ「公開」にできます。</p>
        <DiaryClient entries={entries} />
      </div>
    </>
  );
}
