import Link from 'next/link';
import { getUserContext } from '@/lib/auth';

/** 先生用ヘッダー。ユーザー名を表示（メールは出さない）。 */
export async function Topbar(_props?: { userEmail?: string | null }) {
  const ctx = await getUserContext();
  const name = ctx?.appUser?.name || ctx?.user.email?.split('@')[0] || '';

  return (
    <div className="topbar">
      <Link href="/patients" className="brand">
        WithMIKI<small>カルテ</small>
      </Link>
      <nav className="topnav">
        <Link href="/patients">患者</Link>
        <Link href="/appointments">予約</Link>
        {name ? <span className="topuser">{name}</span> : null}
        <form action="/auth/signout" method="post">
          <button className="btn secondary" type="submit">ログアウト</button>
        </form>
      </nav>
    </div>
  );
}
