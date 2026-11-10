/**
 * Harborline Health Plan Provider Bulletin 2026-07, transcribed verbatim from the PDF the clinic provided
 * (customer_materials/Harborline_Provider_Bulletin_2026-07.pdf; the PDF itself is not in this repo).
 * PDF line wraps are joined with a single space; no wording is changed. `inTool` is this tool's own note,
 * not bulletin text. Pure data: no Next or React imports.
 */
export interface BulletinRule { id: string; text: string; inTool: string }

export const BULLETIN = {
  title: 'Harborline Health Plan',
  subtitle: 'Provider Bulletin 2026-07',
  meta: 'Reimbursement rules for claims from Northgate Family Clinic · Effective July 1, 2026 · Contract NGFC-0417',
  intro: 'This bulletin explains how Harborline Health Plan decides whether to pay a claim that Northgate Family Clinic submits using Northgate Visit Code Set (NVC) codes. A claim is the bill for one visit; it lists the visit\'s codes. A claim that breaks one of the rules below is refused ("denied") or paid at a lower rate, as each rule states.',
  closing: 'Questions about this bulletin should go to your Harborline provider representative.',
} as const;

export const BULLETIN_RULES: readonly BulletinRule[] = [
  {
    id: 'HR-01',
    text: 'Procedures P-310, P-320, and P-330 require prior authorization for members on the Bronze plan. Prior authorization is approval Harborline grants in advance, before the procedure happens; each approval has a reference number, a member, a procedure code, and an expiry date. A Bronze member\'s claim for one of these procedures is denied unless an approval for that member and that procedure is on file.',
    inTool: 'Checked for Bronze members (plan from the roster) against the six prior authorizations in Dana\'s email; the date of service must fall inside the approval window, and the flag names the nearest approval. A member who cannot be matched gets a member warning instead.',
  },
  {
    id: 'HR-02',
    text: 'Harborline Health Plan does not recognize code V-150. A telehealth visit must be billed as V-110 with modifier M-95. Any claim containing V-150 is denied.',
    inTool: 'Flagged on any claim with V-150 (the manual\'s G5 still codes V-150); the code card shows the billable form V-110 + M-95.',
  },
  {
    id: 'HR-03',
    text: 'Only one V- code is paid per member per date of service. A claim with more than one V- code is denied.',
    inTool: 'Flagged when a claim has more than one V- code, or when the same member has another visit with a V- code on the same date in the export (copies of the same encounter and duplicate notes are not counted).',
  },
  {
    id: 'HR-04',
    text: 'P-210 and P-220 cannot both be billed for the same visit. A claim containing both is denied.',
    inTool: 'Flagged when P-210 and P-220 are on the same claim.',
  },
  {
    id: 'HR-05',
    text: 'A claim must contain at least one V- or P- code. A claim with only D- codes is denied.',
    inTool: 'Flagged when a claim has codes but none of them is a V- or P- code.',
  },
  {
    id: 'HR-06',
    text: 'V-130 is paid only when the note documents at least 30 minutes; V-140 only when it documents at least 45. A claim that does not meet the threshold is paid at the V-120 rate instead.',
    inTool: 'Flagged when V-130 has under 30 or V-140 under 45 minutes read from the note (no documented time counts as under).',
  },
  {
    id: 'HR-07',
    text: 'V-200 is paid once per member in any 365-day period. A second V-200 inside that period is denied.',
    inTool: 'Flagged when the same member had another V-200 in the 365 days before; only sees visits in the export.',
  },
  {
    id: 'HR-08',
    text: 'When a V- code and a P- code appear on the same claim, the V- code must carry M-25. If it does not, the P- code is denied.',
    inTool: 'Flagged when V- and P- codes are on a claim without M-25. When the tool adds M-25 only as an assumption (low confidence: the procedure treats the same problem as the visit), HR-08 is still shown so a coder decides.',
  },
];

/** Bulletin anchor for an HR-xx id; null for anything else (WARN-* and G rules). */
export function bulletinHref(ref: string): string | null {
  const id = ref.trim();
  return BULLETIN_RULES.some((r) => r.id === id) ? `/bulletin#${id}` : null;
}

/** Case-insensitive text search over rule id, bulletin text and the tool note. */
export function searchBulletin(q: string): BulletinRule[] {
  const t = q.trim().toLowerCase();
  if (!t) return [...BULLETIN_RULES];
  return BULLETIN_RULES.filter((r) => [r.id, r.text, r.inTool].some((x) => x.toLowerCase().includes(t)));
}
