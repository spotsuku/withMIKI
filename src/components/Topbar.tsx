import Link from 'next/link';

export function Topbar({ userEmail }: { userEmail?: string | null }) {
  return (
    <div className="topbar">
      <Link href="/patients" className="brand">
        WithMIKI<small>カルテ</small>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/patients" className="meta">患者</Link>
        <Link href="/appointments" className="meta">予約</Link>
        {userEmail ? <span className="meta">{userEmail}</span> : null}
        <form action="/auth/signout" method="post">
          <button className="btn secondary" type="submit">
            ログアウト
          </button>
        </form>
      </div>
    </div>
  );
}
