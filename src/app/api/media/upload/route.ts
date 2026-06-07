import { NextResponse, type NextRequest } from 'next/server';
import { getUserContext } from '@/lib/auth';
import { getPatientContext } from '@/lib/patient';
import { createAdminClient, MEDIA_BUCKET } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** メディア画像のアップロード（先生＝患者ID指定 / 患者本人＝自分）。 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 });

  // 先生（患者ID指定）か、患者本人（自分）かを判定
  let tenant: string; let patientId: string;
  const staff = await getUserContext();
  if (staff?.appUser) {
    tenant = staff.appUser.tenant_id;
    patientId = String(form.get('patientId') ?? '');
    if (!patientId) return NextResponse.json({ error: '患者IDが必要です' }, { status: 400 });
  } else {
    const pc = await getPatientContext();
    if (!pc?.patient) return NextResponse.json({ error: '権限がありません' }, { status: 401 });
    tenant = pc.patient.tenant_id;
    patientId = pc.patient.id;
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'メディア保存には SUPABASE_SERVICE_ROLE_KEY が必要です（サーバー設定）。' },
      { status: 503 },
    );
  }

  const safeName = (file.name || 'upload').replace(/[^\w.\-]/g, '_');
  const key = `${tenant}/${patientId}/${crypto.randomUUID()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const up = await admin.storage.from(MEDIA_BUCKET).upload(key, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (up.error) {
    return NextResponse.json({ error: 'アップロードに失敗しました：' + up.error.message }, { status: 502 });
  }

  const { data: att, error: attErr } = await admin
    .from('attachment')
    .insert({
      tenant_id: tenant,
      patient_id: patientId,
      kind: 'media',
      storage_key: key,
      mime: file.type || null,
      size_bytes: buffer.length,
    })
    .select('id')
    .single();
  if (attErr || !att) {
    return NextResponse.json({ error: 'メタ登録に失敗しました：' + (attErr?.message ?? '') }, { status: 502 });
  }

  const { error: mediaErr } = await admin.from('media').insert({
    tenant_id: tenant,
    patient_id: patientId,
    title: (form.get('title') as string | null)?.trim() || (file.name ?? 'メディア'),
    memo: (form.get('memo') as string | null)?.trim() || null,
    category: (form.get('category') as string | null)?.trim() || null,
    taken_date: new Date().toISOString().slice(0, 10),
    attachment_id: (att as { id: string }).id,
  });
  if (mediaErr) {
    return NextResponse.json({ error: 'メディア登録に失敗しました：' + mediaErr.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
