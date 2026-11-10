import type { Suggestion } from '../engine/types';
import { CODES } from '../engine/codes';
import { EVIDENCE_TERMS } from '../engine/suggest';
import { HEADER_START } from '../engine/normalize';

const CODE_ID = /\b[VPDM]-\d+\b/g;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Find the quote in the note allowing any run of whitespace to differ; returns the note's own text, or null. */
function findInNote(note: string, quote: string): { text: string; start: number } | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const m = new RegExp(words.map(escape).join('\\s+')).exec(note);
  return m ? { text: m[0], start: m.index } : null;
}

/** True when the slice runs over more than one line and one of those lines is a header (Member ID, Provider, S/O ...). */
function spansHeader(note: string, start: number, text: string): boolean {
  if (!text.includes('\n')) return false;
  const lineStart = note.lastIndexOf('\n', start) + 1;
  return note.slice(lineStart, start + text.length).split('\n').some((l) => HEADER_START.test(l.trim()));
}

/**
 * Check a model's codes against the note before they are shown. `rulesCodes` are the rules-v1 codes for the
 * same visit: a code that an embedded instruction names is accepted only if the rules found it on their own.
 * Accepted evidence is the exact slice of `note`, so `note.includes(evidence)` always holds.
 */
export function validateLlmCodes(note: string, injected: string[], items: Array<{ code: string; quote: string }>, rulesCodes: string[] = []) {
  const accepted: Suggestion[] = []; const rejected: Array<{ code: string; why: string }> = [];
  const asked = new Set(injected.flatMap((i) => i.match(CODE_ID) ?? []));
  const reject = (code: string, why: string) => rejected.push({ code, why });
  for (const it of items) {
    const quote = (it.quote ?? '').trim();
    if (!CODES.has(it.code)) { reject(it.code, 'not in the code table (G10)'); continue; }
    if (it.code === 'M-95') { reject(it.code, 'M-95 is never assigned (G5)'); continue; }
    if (asked.has(it.code) && !rulesCodes.includes(it.code)) { reject(it.code, 'code is named by an instruction embedded in the note'); continue; }
    if (quote.split(/\s+/).filter(Boolean).length < 3) { reject(it.code, 'quote is shorter than three words (G11)'); continue; }
    const hit = findInNote(note, quote);
    if (!hit) { reject(it.code, 'quote is not in the note (G11)'); continue; }
    if (spansHeader(note, hit.start, hit.text)) { reject(it.code, 'quote runs across a header line'); continue; }
    if (injected.some((i) => i.includes(hit.text) || hit.text.includes(i))) { reject(it.code, 'quote comes from an instruction embedded in the note'); continue; }
    const term = EVIDENCE_TERMS[it.code];
    if (term && !term.test(hit.text)) { reject(it.code, `quote does not name the ${it.code.startsWith('P-') ? 'procedure' : 'visit type'} (G11)`); continue; }
    if (it.code.startsWith('V-') && accepted.some((a) => a.code.startsWith('V-'))) { reject(it.code, 'second V- code (G1)'); continue; }
    if (it.code.startsWith('D-') && accepted.filter((a) => a.code.startsWith('D-')).length >= 4) { reject(it.code, 'more than four D- codes (G4)'); continue; }
    if (accepted.some((a) => a.code === it.code)) continue;
    accepted.push({ code: it.code, evidence: hit.text, rule: 'llm', confidence: 'high' });
  }
  return { accepted, rejected };
}

export function modelLabel(id: string): string {
  const m = id.match(/claude-([a-z]+)-(\d+)-(\d+)/);
  return m ? `${m[1]}-${m[2]}.${m[3]}` : id;
}

/** The model id that answered: the only one in `modelUsage`, else the one matching the requested alias. Throws rather than guess. */
export function pickModel(usage: Record<string, unknown> | undefined, alias: string): string {
  const ids = Object.keys(usage ?? {});
  if (ids.length === 1) return ids[0];
  const match = ids.filter((id) => id.includes(alias));
  if (match.length === 1) return match[0];
  throw new Error(`cannot tell which model answered for alias "${alias}": modelUsage has [${ids.join(', ')}]`);
}
