'use client';

/** 先生のLINE連携ボタン。LINE処理は /liff に集約（mode は sessionStorage 経由）。 */
export function LineLinkButton({ linked }: { linked: boolean }) {
  function go() {
    sessionStorage.setItem('liff_mode', 'link');
    sessionStorage.removeItem('liff_token');
    window.location.href = '/liff';
  }
  return (
    <div>
      {linked ? (
        <p className="meta">✅ 連携済み。ログイン画面の「LINEでログイン」から入れます。</p>
      ) : (
        <p className="meta">連携すると、メール・パスワードの代わりにLINEでログインできます。</p>
      )}
      <button className="btn" style={{ background: '#06c755' }} onClick={go}>
        {linked ? 'LINEを再連携' : 'LINEと連携する'}
      </button>
    </div>
  );
}
