'use client';

export function InviteClient({ token, patientName }: { token: string; patientName: string }) {
  function go() {
    sessionStorage.setItem('liff_mode', 'invite');
    sessionStorage.setItem('liff_token', token);
    window.location.href = '/liff';
  }
  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI へようこそ</h2>
        <p className="meta">{patientName} さんのアカウントを設定します。下のボタンからLINEで登録してください。</p>
        <button className="btn" style={{ width: '100%', background: '#06c755' }} onClick={go}>
          LINEで登録・ログイン
        </button>
      </div>
    </div>
  );
}
