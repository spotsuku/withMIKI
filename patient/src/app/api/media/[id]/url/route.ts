import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPatientContext } from '@/lib/patient';
import { createAdminClient, MEDIA_BUCKET } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return NextResponse.json({ error: '権限がありません' }, { status: 401 });

  const supabase = createClient();
  const { data: media } = await supabase.from('media').select('attachment_id').eq('id', params.id).maybeSingle();
  const attachmentId = (media as { attachment_id: string | null } | null)?.attachment_id;
  if (!attachmentId) return NextResponse.json({ error: '見つかりません' }, { status: 404 });
  const { data: att } = await supabase.from('attachment').select('storage_key').eq('id', attachmentId).maybeSingle();
  const key = (att as { storage_key: string } | null)?.storage_key;
  if (!key) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'サーバー設定が未完了です' }, { status: 503 });
  const { data: signed, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(key, 120);
  if (error || !signed) return NextResponse.json({ error: '署名URL発行に失敗しました' }, { status: 502 });
  return NextResponse.redirect(signed.signedUrl);
}
