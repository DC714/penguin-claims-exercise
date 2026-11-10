import type { Suggestion } from '../engine/types';

const TABLE = new Set(['V-110','V-120','V-130','V-140','V-150','V-200','V-300','P-210','P-220','P-310','P-320','P-330','P-410','P-420','P-430',
  'D-101','D-102','D-103','D-104','D-105','D-106','D-107','D-108','D-109','D-110','D-111','D-112','D-113','D-114','D-115','D-116','M-25','M-52','M-95']);
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

export function validateLlmCodes(note: string, injected: string[], items: Array<{ code: string; quote: string }>) {
  const body = squash(note);
  const accepted: Suggestion[] = []; const rejected: Array<{ code: string; why: string }> = [];
  for (const it of items) {
    const q = squash(it.quote ?? '');
    if (!TABLE.has(it.code)) { rejected.push({ code: it.code, why: 'not in the code table (G10)' }); continue; }
    if (!q || !body.includes(q)) { rejected.push({ code: it.code, why: 'quote is not in the note (G11)' }); continue; }
    if (injected.some((i) => squash(i).includes(q) || q.includes(squash(i)))) { rejected.push({ code: it.code, why: 'quote comes from an instruction embedded in the note' }); continue; }
    if (it.code.startsWith('V-') && accepted.some((a) => a.code.startsWith('V-'))) { rejected.push({ code: it.code, why: 'second V- code (G1)' }); continue; }
    if (it.code.startsWith('D-') && accepted.filter((a) => a.code.startsWith('D-')).length >= 4) { rejected.push({ code: it.code, why: 'more than four D- codes (G4)' }); continue; }
    if (accepted.some((a) => a.code === it.code)) continue;
    accepted.push({ code: it.code, evidence: q, rule: 'llm', confidence: 'high' });
  }
  return { accepted, rejected };
}

export function modelLabel(id: string): string {
  const m = id.match(/claude-([a-z]+)-(\d+)-(\d+)/);
  return m ? `${m[1]}-${m[2]}.${m[3]}` : id;
}
