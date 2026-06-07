/** 日記の共通処理。ログイン版（/diary）とトークン版（/r/[token]）で共用。 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DiaryRow {
  id: string; entry_date: string; mood: string | null; title: string | null; body: string; is_shared: boolean;
}

export const DIARY_MOODS = ['😊 良い', '😐 普通', '😢 落ち込み', '😤 イライラ', '😴 眠い', '😰 不安', '🌟 元気'];

function jstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

export async function listDiary(db: SupabaseClient, patientId: string, limit = 60): Promise<DiaryRow[]> {
  const { data } = await db
    .from('diary_entry')
    .select('id, entry_date, mood, title, body, is_shared')
    .eq('patient_id', patientId)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as DiaryRow[];
}

export async function addDiary(db: SupabaseClient, patient: { id: string; tenant_id: string }, fd: FormData): Promise<{ error?: string }> {
  const entry_date = (String(fd.get('entry_date') ?? '').trim()) || jstToday();
  const body = String(fd.get('body') ?? '').trim();
  const title = String(fd.get('title') ?? '').trim() || null;
  const mood = String(fd.get('mood') ?? '').trim() || null;
  const is_shared = fd.get('is_shared') === 'on';
  if (!body && !title) return { error: '内容を入力してください。' };
  const { error } = await db.from('diary_entry').insert({ tenant_id: patient.tenant_id, patient_id: patient.id, entry_date, mood, title, body, is_shared });
  if (error) return { error: '保存に失敗しました：' + error.message };
  return {};
}

/** 公開/非公開の切替（本人のエントリのみ） */
export async function setDiaryShare(db: SupabaseClient, patientId: string, id: string, isShared: boolean): Promise<{ error?: string }> {
  const { error } = await db.from('diary_entry').update({ is_shared: isShared }).eq('id', id).eq('patient_id', patientId);
  if (error) return { error: '更新に失敗しました：' + error.message };
  return {};
}

/** 論理削除（本人のエントリのみ） */
export async function deleteDiary(db: SupabaseClient, patientId: string, id: string): Promise<{ error?: string }> {
  const { error } = await db.from('diary_entry').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('patient_id', patientId);
  if (error) return { error: '削除に失敗しました：' + error.message };
  return {};
}
