import type { Member } from './load';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, '').trim();

export function resolveMember(p: { memberId?: string; name?: string; dob?: string }, roster: Member[]) {
  if (p.memberId) {
    const m = roster.find((r) => r.memberId === p.memberId);
    if (m) return { member: m, method: 'id' as const };
  }
  if (!p.name) return { method: 'none' as const };
  const parts = norm(p.name).split(/\s+/);
  const [first, last] = [parts[0], parts[parts.length - 1]];
  const byName = roster.filter((r) => norm(r.first) === first && norm(r.last) === last);
  if (p.dob) { const m = byName.filter((r) => r.dob === p.dob); if (m.length === 1) return { member: m[0], method: 'name+dob' as const }; }
  if (byName.length === 1) return { member: byName[0], method: 'name' as const };
  return { method: byName.length > 1 ? ('ambiguous' as const) : ('none' as const) };
}

/** Stable key for "same note exported twice": sentences with whitespace and case removed. */
export function bodyKey(sentences: string[]): string {
  return sentences.join('|').toLowerCase().replace(/[^a-z0-9|]/g, '');
}
