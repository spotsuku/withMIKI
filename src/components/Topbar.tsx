import Link from 'next/link';
import { getUserContext } from '@/lib/auth';

/** 先生用ヘッダー。ナビはボタン風、ユーザーは丸アイコン表示。 */
export async function Topbar(_props?: { userEmail?: string | null }) {
  const ctx = await getUserContext();
  const name = ctx?.appUser?.name || ctx?.user.email?.split('@')[0] || '';
  const initial = name.trim().charAt(0) || 'M';

  return (
    <div className="topbar">
      <Link href="/patients" className="brand">WithMIKI</Link>
      <nav className="topnav">
        <Link href="/patients" className="navbtn">カルテ</Link>
        <Link href="/appointments" className="navbtn">予約</Link>
        <Link href="/settings" className="avatar-mini" title={`${name}（設定）`}>{initial}</Link>
        <form action="/auth/signout" method="post">
          <button className="navbtn" type="submit">ログアウト</button>
        </form>
      </nav>
    </div>
  );
}
