import { parseNote } from './parse';
import type { EngineResult, NotCoded, Suggestion, Warning } from './types';

const DX: Array<[RegExp, string]> = [
  [/^hypertension\b/i, 'D-101'], [/^type 2 diabetes\b/i, 'D-102'], [/^upper respiratory infection\b/i, 'D-103'],
  [/^low back pain\b/i, 'D-104'], [/^anxiety\b/i, 'D-105'], [/^knee pain\b/i, 'D-107'], [/^skin lesion\b/i, 'D-108'],
  [/^asthma\b/i, 'D-109'], [/^ankle sprain\b/i, 'D-110'], [/^sore throat\b/i, 'D-111'], [/^chest pain\b/i, 'D-112'],
  [/^headache\b/i, 'D-115'], [/^medication (refill|management)\b/i, 'D-116'],
];
const TIME = /(?<![\d.])\b(\d{1,3})\s*(?:minutes|minuets|min)\b/i;
/** Bare "m" ("Time 55m", "25 m") is read as minutes only in a sentence about time; "52 M presents" is age and sex. */
const TIME_M = /(?<![\d.])\b(\d{1,3}) ?m\b/i;
const TIME_M_CTX = /\b(time|spent|duration|face-to-face|total|visit)\b/i;
const TIME_CTX = /time|spent|face-to-face|duration|total|\(\d+ ?min\)/i;
const minutesIn = (s: string) => s.match(TIME) ?? (TIME_M_CTX.test(s) ? s.match(TIME_M) : null);
/**
 * A visit-type phrase that is not the visit being coded: a hedge word directly before it
 * ("Discussed telehealth", "Last wellness visit", "Prefers a video visit"). A hedge elsewhere in the
 * sentence ("Telephone visit to discuss hypertension") does not count.
 */
const HEDGE_BEFORE = /\b(?:discuss|offer|prefer|consider|next|future|last|prior|previous|will)\w*\s+(?:(?:an?|the|for)\s+)?$/i;
const visitPhrase = (s: string, re: RegExp) => {
  const g = new RegExp(re.source, 'gi');
  for (const m of s.matchAll(g)) if (!HEDGE_BEFORE.test(s.slice(0, m.index))) return true;
  return false;
};
const TELE = /\b(video visit|telephone visit|telehealth|virtual care|phone visit)\b/i;
const WELL = /\b(annual wellness|yearly physical|preventive exam|wellness visit|wellness vist)\b/i;
const URGENT = /\b(same-day add-on|walked in with acute|walk-in)\b/i;
const PURPOSE = /^(?:patient )?here for (?:a )?(?:scheduled|removal)|^scheduled (?:ecg|spirometry)|^walk-in for laceration/i;
const NEG_WORD = '(?:declin|offered|discus+|recommend|order|will reconsider)';
// Negation must sit next to the procedure, not anywhere in the sentence: "Splint applied; crutches not given" is a splint.
const NEG = '(?:no|not|never|without|deferred|unable to|refused|did not|was not)';
/** A negation ending at most two words before a position ("No injection", "no prior ECG"). */
const NEG_BEFORE = new RegExp(`\\b${NEG}(?:\\s+[\\w-]+){0,2}\\s+$`, 'i');
const VERB = '(?:performed|given|applied|obtained|injected|done)';
/** Procedure term negated right before or right after it ("No injection", "Splint not applied", "strep was not performed"). */
const negatedTerm = (term: RegExp) =>
  new RegExp(`\\b${NEG}(?:\\s+[\\w-]+){0,2}\\s+(?:${term.source})|(?:${term.source})\\w*(?:\\s+(?:was|is|were))?\\s+(?:not|never)\\s+(?:\\w+\\s+)?${VERB}`, 'i');
const WOUND_NEG = new RegExp(`\\b${NEG}(?:\\s+[\\w-]+){0,2}\\s+(?:closure|repair|sutur)|not (?:closed|repaired|sutured)`, 'i');
const negNear = (term: RegExp) => new RegExp(`${NEG_WORD}\\w*[^.]{0,40}(?:${term.source})|(?:${term.source})[^.]{0,40}(?:declin|recommend|order|offered)`, 'i');

interface Proc { code: string; term: RegExp; done: RegExp; partial?: RegExp }
const PROCS: Proc[] = [
  { code: 'P-310', term: /injection/i, done: /injected into (the )?joint|performed .{0,40}injection|injection (was )?(performed|given)/i, partial: /injection attempted|stopped before medication/i },
  { code: 'P-320', term: /excision|removal|remov\w*/i, done: /shave excision performed|removed an? [\d.]+ mm lesion/i, partial: /removal started|halted after partial/i },
  { code: 'P-330', term: /splint/i, done: /splint applied/i },
  { code: 'P-410', term: /\becg\b/i, done: /(12-lead|ecg) obtained/i },
  { code: 'P-420', term: /spirometry/i, done: /test performed, fev|spirometry performed/i },
  { code: 'P-430', term: /strep/i, done: /rapid strep (swab )?performed/i },
];
/** The finding each procedure treats; a visit finding outside this set is a separate problem (G6). */
const PROC_DX: Record<string, string[]> = {
  'P-210': ['D-106'], 'P-220': ['D-106'], 'P-310': ['D-107'], 'P-320': ['D-108'], 'P-330': ['D-114', 'D-110'],
  'P-410': ['D-112'], 'P-420': ['D-109'], 'P-430': ['D-111'],
};
const WOUND = /Wound measured ([\d.]+) cm[^.]*?(single-layer|layered)/i;

export function suggestCodes(raw: string): EngineResult {
  const note = parseNote(raw);
  const S = note.sentences;
  const sug: Suggestion[] = [];
  const notCoded: NotCoded[] = [];
  const warnings: Warning[] = [];
  for (const inj of note.injected) warnings.push({ kind: 'injection', message: 'Note contains text addressed to a coder/system. Ignored.', evidence: inj });

  // --- procedures (G3, G7) ---
  const procs: Suggestion[] = [];
  const skipped: NotCoded[] = [];
  for (const s of S) {
    for (const p of PROCS) {
      if (procs.some((x) => x.code === p.code)) continue;
      const done = s.match(p.done);
      if (done && !NEG_BEFORE.test(s.slice(0, done.index))) procs.push({ code: p.code, evidence: s, rule: 'G3', confidence: 'high' });
      else if (done || negatedTerm(p.term).test(s)) {
        if (p.term.test(s)) skipped.push({ code: p.code, evidence: s, reason: 'Negated: procedure not performed (G3)' });
      } else if (p.partial?.test(s)) {
        procs.push({ code: p.code, evidence: s, rule: 'G3', confidence: 'high' });
        procs.push({ code: 'M-52', evidence: s, rule: 'G7', confidence: 'high', note: `Started but not completed (${p.code})` });
      } else if (negNear(p.term).test(s))
        skipped.push({ code: p.code, evidence: s, reason: 'Discussed, offered, recommended or declined, not performed (G3)' });
    }
    const w = s.match(WOUND);
    if (w && !WOUND_NEG.test(s) && !procs.some((x) => x.code === 'P-210' || x.code === 'P-220')) {
      const code = +w[1] > 5 || /layered/i.test(w[2]) ? 'P-220' : 'P-210';
      procs.push({ code, evidence: s, rule: 'G3', confidence: 'high' });
    }
  }
  // Only report codes that were not performed elsewhere in the note; first sentence per code.
  for (const n of skipped) if (!procs.some((x) => x.code === n.code) && !notCoded.some((x) => x.code === n.code)) notCoded.push(n);
  const performed = procs.filter((p) => p.code.startsWith('P-'));

  // --- time ---
  let minutes: number | null = null; let timeSentence: string | undefined;
  const ts = S.find((s) => TIME_CTX.test(s) && minutesIn(s)) ?? S.find((s) => minutesIn(s));
  if (ts) { minutes = +minutesIn(ts)![1]; timeSentence = ts; }

  // --- visit code (G1, G2, G5, G6, G8, G9) ---
  const ctx = (re: RegExp) => S.find((s) => visitPhrase(s, re));
  const tele = ctx(TELE);
  const well = ctx(WELL);
  const purpose = S.find((s) => PURPOSE.test(s));
  const noOther = S.some((s) => /no other problems addressed/i.test(s));
  const urgent = ctx(URGENT);
  let v: Suggestion | null = null;
  if (tele) v = { code: 'V-150', evidence: tele, rule: 'G5', confidence: 'high', note: 'Harborline denies V-150 (HR-02); billable form is V-110 + M-95' };
  else if (well) v = { code: 'V-200', evidence: well, rule: 'G8', confidence: 'high' };
  else if (performed.length && (purpose || noOther)) v = null; // procedure-only visit (G6)
  else if (urgent) v = { code: 'V-300', evidence: urgent, rule: 'G9', confidence: 'high' };
  else {
    const code = minutes === null ? 'V-120' : minutes < 15 ? 'V-110' : minutes < 30 ? 'V-120' : minutes < 45 ? 'V-130' : 'V-140';
    const ev = timeSentence ?? S.find((s) => /visit|vist/i.test(s) && s.length < 80) ?? S[0];
    if (ev) v = { code, evidence: ev, rule: 'G2', confidence: 'high', note: minutes === null ? 'Time not documented, default V-120' : undefined };
  }
  if (v) sug.push(v);
  const m25At = sug.length;
  sug.push(...procs);

  // --- findings (G4) ---
  const dx: Array<{ code: string; evidence: string; idx: number }> = [];
  const add = (code: string, evidence: string, idx: number) => { if (!dx.some((d) => d.code === code)) dx.push({ code, evidence, idx }); };
  S.forEach((s, i) => { for (const [re, code] of DX) if (re.test(s)) add(code, s, i); });
  if (well) add('D-113', well, -1);
  const find = (re: RegExp) => { const i = S.findIndex((s) => re.test(s)); return i < 0 ? null : { s: S[i], i }; };
  const lac = find(/laceration/i); if (lac) add('D-106', lac.s, lac.i);
  const les = find(/lesion/i);
  if (les && performed.some((p) => p.code === 'P-320')) add('D-108', les.s, les.i);
  const knee = find(/knee/i); if (knee && performed.some((p) => p.code === 'P-310')) add('D-107', knee.s, knee.i);
  const procOnly = !v && performed.length > 0;
  const chest = find(/chest pain/i); if (chest && procOnly && performed.some((p) => p.code === 'P-410')) add('D-112', chest.s, chest.i);
  const asth = find(/asthma/i); if (asth && performed.some((p) => p.code === 'P-420')) add('D-109', asth.s, asth.i);
  const wrist = find(/wrist/i); if (wrist && performed.some((p) => p.code === 'P-330')) add('D-114', wrist.s, wrist.i);
  const ankle = find(/ankle/i); if (ankle && performed.some((p) => p.code === 'P-330')) add('D-110', ankle.s, ankle.i);
  dx.sort((a, b) => a.idx - b.idx);

  // --- M-25 (G6, HR-08): cite the problem the visit addressed apart from the procedure ---
  if (v && performed.length) {
    const procDx = new Set(performed.flatMap((p) => PROC_DX[p.code] ?? []));
    const sep = dx.slice(0, 4).find((d) => !procDx.has(d.code));
    sug.splice(m25At, 0, sep
      ? { code: 'M-25', evidence: sep.evidence, rule: 'G6', confidence: 'high', note: `Visit addressed ${sep.code}, separate from the procedure. Harborline also requires M-25 here (HR-08).` }
      : { code: 'M-25', evidence: v.evidence, rule: 'G6/HR-08', confidence: 'low', note: 'No problem separate from the procedure found, so G6 does not call for M-25; Harborline denies the procedure without it (HR-08). Coder to decide.' });
  }
  if (dx.length > 4) warnings.push({ kind: 'too_many_dx', message: `More than four problems addressed; kept the first four (G4).` });
  for (const d of dx.slice(0, 4)) sug.push({ code: d.code, evidence: d.evidence, rule: 'G4', confidence: 'high' });
  if (!dx.length) warnings.push({ kind: 'no_dx', message: 'No problem recognised in the note. Needs a human or model read.' });
  if (!sug.length) warnings.push({ kind: 'no_codes', message: 'No codes could be supported from this note.' });

  const needsEscalation = sug.some((s) => s.confidence === 'low') || warnings.some((w) => w.kind === 'injection' || w.kind === 'no_dx' || w.kind === 'no_codes');
  return { suggestions: sug, notCoded, warnings, minutes, needsEscalation };
}

/** Claim order: V, M-25, P, M-52, D. */
export function claimCodes(s: Suggestion[]): string[] {
  const rank = (c: string) => (c.startsWith('V-') ? 0 : c === 'M-25' ? 1 : c.startsWith('P-') ? 2 : c.startsWith('M-') ? 3 : 4);
  return s.map((x) => x.code).map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c);
}
