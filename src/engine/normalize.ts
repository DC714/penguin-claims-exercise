export const HEADER_START = /^(Member ID|Pt:|Patient:|Date\b|Provider:|S\/O:|A\/P:|Encounter #|DOS\b|Northgate Family Clinic)/;
const HEADER_SENT = /^(Member ID|DOS\b|Seen by|Pt:|Patient:|Provider:|Date( of service)?:|Encounter #|Northgate Family Clinic)/;
const SPLIT = /(?<!\b(?:Dr|Pt|approx|PA|NP|[A-Z])\.)(?<=\.)\s+(?=[A-Z(\[])/;

/** Join PDF-wrapped lines; keep header lines and "- " bullets on their own line. Idempotent. */
export function normalizeNote(raw: string): string {
  // defensive: some PDF extractors lose newlines
  const text = raw
    .replace(/[ \t]+-\s+(?=[A-Z(])/g, '\n- ')
    .replace(/[ \t]+(?=(?:Member ID|Pt|Patient|Provider|S\/O|A\/P):)/g, '\n');
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (out.length && !l.startsWith('- ') && !HEADER_START.test(l)) out[out.length - 1] += ' ' + l;
    else out.push(l);
  }
  return out.join('\n');
}

export function splitSentences(normalized: string): string[] {
  const res: string[] = [];
  for (const line of normalized.split('\n')) {
    for (const piece of line.split(SPLIT)) {
      const s = piece.trim().replace(/^(?:- |S\/O:\s*|A\/P:\s*)+/, '').trim();
      if (s && !HEADER_SENT.test(s)) res.push(s);
    }
  }
  return res;
}
