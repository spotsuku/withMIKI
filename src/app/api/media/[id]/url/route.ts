import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, MEDIA_BUCKET } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** メディアの短命署名URLへリダイレクト（先生・患者どちらも。所有は RLS で検証）。 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // RLS が効くユーザークライアントで所有確認（先生＝テナント、患者＝本人）
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '権限がありません' }, { status: 401 });

  const { data: media } = await supabase
    .from('media')
    .select('attachment_id')
    .eq('id', params.id)
    .maybeSingle();
  const attachmentId = (media as { attachment_id: string | null } | null)?.attachment_id;
  if (!attachmentId) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  const { data: att } = await supabase
    .from('attachment')
    .select('storage_key')
    .eq('id', attachmentId)
    .maybeSingle();
  const key = (att as { storage_key: string } | null)?.storage_key;
  if (!key) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'サーバー設定が未完了です' }, { status: 503 });

  const { data: signed, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(key, 120);
  if (error || !signed) {
    return NextResponse.json({ error: '署名URL発行に失敗しました' }, { status: 502 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
