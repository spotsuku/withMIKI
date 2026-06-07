/** 先生のLINE連携ボタン（標準LINEログインのWebフローへ遷移）。 */
export function LineLinkButton({ linked, status }: { linked: boolean; status?: string }) {
  return (
    <div>
      {linked ? (
        <p className="meta">✅ 連携済み。ログイン画面の「LINEでログイン」から入れます。</p>
      ) : (
        <p className="meta">連携すると、メール・パスワードの代わりにLINEでログインできます。</p>
      )}
      <a className="btn" style={{ background: '#06c755' }} href="/api/auth/line/start?mode=link">
        {linked ? 'LINEを再連携' : 'LINEと連携する'}
      </a>
      {status === 'linked' ? <p className="meta" style={{ marginTop: 8 }}>✅ LINEと連携しました。</p> : null}
      {status === 'inuse' ? <p className="error">このLINEは既に別の利用者に連携されています。</p> : null}
      {status === 'error' ? <p className="error">連携に失敗しました。もう一度お試しください。</p> : null}
      {status === 'unconfigured' ? <p className="error">LINEログインが未設定です（サーバー設定）。</p> : null}
    </div>
  );
}
