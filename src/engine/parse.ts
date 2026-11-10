import { DATE_RE, parseDate } from './dates';
import { normalizeNote, splitSentences } from './normalize';
import type { ParsedNote } from './types';

export const INJECTION = /(ignore (the )?(coding|guideline)|automated coding|AI coder|\[system\]|pre-approved|supersedes|do not flag|carry forward [VPDM]-\d+|bill [VPDM]-\d+|prior coder used [VPDM]-\d+|exempt from prior auth|approve all procedures|\b(?:coder|coding (?:system|assistant|guideline)|system prompt)\b|\b(?:assign|add|use|code|bill|append|record|approve|output)\b[^.]{0,30}\b[VPDM]-\d+|mark denial risk)/i;
const DOB_RE = /DOB\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]{3} \d{1,2}, \d{4})/;

export function parseNote(raw: string): ParsedNote {
  const normalized = normalizeNote(raw);
  const memberId = normalized.match(/\bM-\d{6}\b/)?.[0];
  const patientName = normalized.match(/(?:Patient|Pt):\s*([^\d(,|\n.]+?)\s*(?:\(|,|\||\.|\n|$)/)?.[1]?.trim();
  const dobRaw = normalized.match(DOB_RE)?.[1];
  const withoutDob = normalized.replace(new RegExp(DOB_RE.source, 'g'), '');
  const dosRaw = withoutDob.match(DATE_RE)?.[0];
  const all = splitSentences(normalized);
  return {
    normalized,
    memberId,
    patientName,
    dob: dobRaw ? parseDate(dobRaw) ?? undefined : undefined,
    dos: dosRaw ? parseDate(dosRaw) ?? undefined : undefined,
    sentences: all.filter((s) => !INJECTION.test(s)),
    injected: all.filter((s) => INJECTION.test(s)),
  };
}
