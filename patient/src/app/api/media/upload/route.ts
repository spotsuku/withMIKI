import { NextResponse, type NextRequest } from 'next/server';
import { getPatientContext } from '@/lib/patient';
import { createAdminClient, MEDIA_BUCKET } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** 患者本人によるメディアアップロード */
export async function POST(req: NextRequest) {
  const ctx = await getPatientContext();
  if (!ctx?.patient) return NextResponse.json({ error: '権限がありません' }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'メディア保存にはサーバー設定（SUPABASE_SERVICE_ROLE_KEY）が必要です。' }, { status: 503 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 });

  const tenant = ctx.patient.tenant_id;
  const patientId = ctx.patient.id;
  const safeName = (file.name || 'upload').replace(/[^\w.\-]/g, '_');
  const key = `${tenant}/${patientId}/${crypto.randomUUID()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const up = await admin.storage.from(MEDIA_BUCKET).upload(key, buffer, { contentType: file.type || 'application/octet-stream' });
  if (up.error) return NextResponse.json({ error: 'アップロード失敗：' + up.error.message }, { status: 502 });

  const { data: att, error: attErr } = await admin.from('attachment')
    .insert({ tenant_id: tenant, patient_id: patientId, kind: 'media', storage_key: key, mime: file.type || null, size_bytes: buffer.length })
    .select('id').single();
  if (attErr || !att) return NextResponse.json({ error: 'メタ登録失敗：' + (attErr?.message ?? '') }, { status: 502 });

  const { error: mErr } = await admin.from('media').insert({
    tenant_id: tenant, patient_id: patientId,
    title: (form.get('title') as string | null)?.trim() || (file.name ?? 'メディア'),
    memo: (form.get('memo') as string | null)?.trim() || null,
    category: (form.get('category') as string | null)?.trim() || null,
    taken_date: new Date().toISOString().slice(0, 10),
    attachment_id: (att as { id: string }).id,
  });
  if (mErr) return NextResponse.json({ error: 'メディア登録失敗：' + mErr.message }, { status: 502 });

  return NextResponse.json({ ok: true });
}
