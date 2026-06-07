'use client';

export function InviteClient({ token, patientName }: { token: string; patientName: string }) {
  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI へようこそ</h2>
        <p className="meta">{patientName} さんのアカウントを設定します。下のボタンからLINEで登録してください。</p>
        <a className="btn" style={{ width: '100%', background: '#06c755', textAlign: 'center', display: 'block' }}
          href={`/liff?mode=invite&token=${encodeURIComponent(token)}`}>
          LINEで登録・ログイン
        </a>
      </div>
    </div>
  );
}
