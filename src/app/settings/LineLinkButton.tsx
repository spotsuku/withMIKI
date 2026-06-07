/** 先生のLINE連携ボタン。LINE処理は /liff に集約（mode=link）。 */
export function LineLinkButton({ linked }: { linked: boolean }) {
  return (
    <div>
      {linked ? (
        <p className="meta">✅ 連携済み。ログイン画面の「LINEでログイン」から入れます。</p>
      ) : (
        <p className="meta">連携すると、メール・パスワードの代わりにLINEでログインできます。</p>
      )}
      <a className="btn" style={{ background: '#06c755' }} href="/liff?mode=link">
        {linked ? 'LINEを再連携' : 'LINEと連携する'}
      </a>
    </div>
  );
}
