import { createHmac, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MEDIA_BUCKET } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

function channelSecret(): string | undefined {
  return process.env.LINE_MESSAGING_CHANNEL_SECRET || process.env.LINE_CHANNEL_SECRET;
}
function accessToken(): string | undefined {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_MESSAGING_ACCESS_TOKEN;
}

/** LINE 公式アカウントの受信（Webhook）。署名検証 → 友だち追加・メッセージ・画像をカルテに取り込む。 */
export async function POST(req: NextRequest) {
  const secret = channelSecret();
  const admin = createAdminClient();
  // 設定不足でも 200 を返す（LINEの再送ループ回避）
  if (!secret || !admin) return NextResponse.json({ ok: true });

  const raw = await req.text();
  const signature = req.headers.get('x-line-signature') || '';
  const expected = createHmac('sha256', secret).update(raw).digest('base64');
  if (signature !== expected) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  let body: { events?: LineEvent[] };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  for (const ev of body.events ?? []) {
    try { await handleEvent(admin, ev); } catch { /* 1件の失敗で全体を止めない */ }
  }
  return NextResponse.json({ ok: true });
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { id: string; type: string; text?: string; fileName?: string };
}

async function handleEvent(admin: Admin, ev: LineEvent) {
  const lineUserId = ev.source?.userId;
  if (!lineUserId) return;

  // 連携済みなら患者を特定
  const { data: la } = await admin.from('line_account').select('tenant_id, patient_id').eq('line_user_id', lineUserId).maybeSingle();
  const link = la as { tenant_id: string; patient_id: string } | null;

  if (ev.type === 'follow') {
    await reply(ev.replyToken, link
      ? 'WithMIKI へようこそ。こちらからご連絡・写真の送信ができます。'
      : 'WithMIKI です。ご利用には先生から届く招待URLからの登録が必要です。');
    return;
  }

  if (ev.type === 'message' && ev.message) {
    const m = ev.message;
    if (m.type === 'text') {
      await admin.from('line_inbound_message').insert({
        line_user_id: lineUserId, patient_id: link?.patient_id ?? null, message_type: 'text', payload: { text: m.text ?? '' },
      });
      await reply(ev.replyToken, 'メッセージを受け取りました。先生が確認します。');
      return;
    }
    if (m.type === 'image' || m.type === 'file') {
      await admin.from('line_inbound_message').insert({
        line_user_id: lineUserId, patient_id: link?.patient_id ?? null, message_type: m.type, payload: { messageId: m.id, fileName: m.fileName ?? null },
      });
      // 連携済みならカルテのメディアに保存
      if (link) await saveContentToKarte(admin, link, m.id, m.type, m.fileName);
      await reply(ev.replyToken, link ? '画像を受け取り、カルテに保存しました。' : '画像を受け取りました。登録後にカルテへ反映されます。');
      return;
    }
  }
}

/** LINEのメッセージ添付（画像/ファイル）をダウンロードして patient のカルテに保存 */
async function saveContentToKarte(admin: Admin, link: { tenant_id: string; patient_id: string }, messageId: string, type: string, fileName?: string) {
  const token = accessToken();
  if (!token) return;
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const mime = res.headers.get('content-type') || (type === 'image' ? 'image/jpeg' : 'application/octet-stream');
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : (fileName?.split('.').pop() || 'bin');
  const key = `${link.tenant_id}/${link.patient_id}/${randomUUID()}_line.${ext}`;

  const up = await admin.storage.from(MEDIA_BUCKET).upload(key, buffer, { contentType: mime, upsert: false });
  if (up.error) return;

  const { data: att } = await admin.from('attachment')
    .insert({ tenant_id: link.tenant_id, patient_id: link.patient_id, kind: 'media', storage_key: key, mime, size_bytes: buffer.length })
    .select('id').single();
  if (!att) return;
  await admin.from('media').insert({
    tenant_id: link.tenant_id, patient_id: link.patient_id,
    title: 'LINEから受信', memo: null, category: 'line',
    taken_date: new Date().toISOString().slice(0, 10),
    attachment_id: (att as { id: string }).id,
  });
}

/** 受信に対する自動返信（reply token は1回・短時間のみ有効） */
async function reply(replyToken: string | undefined, text: string) {
  const token = accessToken();
  if (!replyToken || !token) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch { /* ignore */ }
}
