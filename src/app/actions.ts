'use server';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { visitHref } from '@/lib/format';

export async function review(formData: FormData) {
  const enc = String(formData.get('enc'));
  const source = String(formData.get('source'));
  const code = String(formData.get('code'));
  const decision = String(formData.get('decision'));
  const reviewer = String(formData.get('reviewer') || '').trim().slice(0, 60) || 'anonymous';
  if (!['accept', 'reject'].includes(decision) || !enc || !source || !code) return;
  await sql`insert into reviews (enc_id, source, code, decision, reviewer) values (${enc}, ${source}, ${code}, ${decision}, ${reviewer})
            on conflict (enc_id, source, code, reviewer) do update set decision = excluded.decision, at = now()`;
  revalidatePath(visitHref(enc));
}
