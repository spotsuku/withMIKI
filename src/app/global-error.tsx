'use client';

/**
 * ルートレイアウト自体が壊れた場合の最終エラー画面。
 * global-error はルートの <html>/<body> を置き換えるため自前で描画する。
 * globals.css が読めない状況もあり得るのでスタイルはインラインで持つ。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          background: '#f5f7fb',
          color: '#1f2733',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        }}
      >
        <div style={{ maxWidth: 380, margin: '18vh auto', padding: '0 16px' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 18px',
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: '1.05rem' }}>
              アプリを表示できませんでした
            </h2>
            <p style={{ color: '#6b7280', fontSize: '.85rem' }}>
              再読み込みすると直ることがほとんどです。直らない場合は、いったんアプリを閉じて開き直してください。
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#0b3da6',
                color: '#fff',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              再読み込み
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
