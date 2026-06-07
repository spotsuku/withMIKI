import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/today', icon: '📝', label: '今日の記録', sub: '体調・症状を入力' },
  { href: '/diary', icon: '📔', label: '日記', sub: '自由記述・公開選択' },
  { href: '/reserve', icon: '📅', label: '予約する', sub: '空き枠から予約' },
  { href: '/history', icon: '📈', label: '推移・周期', sub: 'グラフ・カレンダー' },
  { href: '/food', icon: '🍱', label: '食事', sub: '食事・栄養' },
  { href: '/labs', icon: '🩸', label: '採血', sub: '検査値の入力' },
  { href: '/media', icon: '📷', label: '写真', sub: 'メディア' },
  { href: '/mypage/sharing', icon: '🔒', label: '共有設定', sub: '先生への公開/非公開' },
];

export default async function MyPage() {
  if (!isSupabaseConfigured()) redirect('/today');
  const ctx = await getPatientContext();
  if (!ctx) redirect('/login');

  return (
    <>
      <div className="topbar">
        <span className="brand">WithMIKI<small>マイページ</small></span>
        <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">ログアウト</button></form>
      </div>
      <div className="container">
        <h1 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          {ctx.patient?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ctx.patient.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
          ) : null}
          <span>マイページ {ctx.patient?.name ? <span className="meta">{ctx.patient.name} さん</span> : null}</span>
        </h1>
        {!ctx.patient ? (
          <div className="notice">このアカウントはまだ患者情報にひも付いていません。担当の先生にご連絡ください。</div>
        ) : (
          <div className="grid cols-2" style={{ marginTop: 8 }}>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="card" style={{ display: 'block', textDecoration: 'none', color: 'var(--ink)' }}>
                <div style={{ fontSize: 26 }}>{l.icon}</div>
                <div style={{ fontWeight: 700 }}>{l.label}</div>
                <div className="meta">{l.sub}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
