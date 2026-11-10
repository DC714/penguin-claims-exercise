/**
 * Northgate Family Clinic coding manual v3.2, transcribed verbatim from the PDF the clinic provided
 * (customer_materials/Northgate_Coding_Manual_v3.2.pdf; the PDF itself is not in this repo).
 * PDF line wraps are joined with a single space; no wording is changed.
 * This module is the single source of truth for the code table and rules (manual page, validator, model prompt).
 * Pure data: no Next or React imports, so the engine can use it.
 */
export type CodeKind = 'visit' | 'procedure' | 'finding' | 'modifier';
export interface ManualCode { code: string; kind: CodeKind; meaning: string; when?: string }
export interface ManualRule { id: string; text: string }

export const MANUAL = {
  title: 'Northgate Family Clinic',
  subtitle: 'Coding Manual, version 3.2',
  maintained: 'Maintained by the clinic coding team. Last revised August 2026.',
  intro: "This manual lists every code the clinic uses and the rules for assigning them to a visit. It is the clinic's source of truth for coding. The insurer pays claims based on these codes; codes that are missing, wrong, or not supported by the note cause the claim to be denied.",
  kinds: [
    'Visit codes (V-) describe the visit itself: what kind, and how long.',
    'Procedure codes (P-) describe something done to the patient.',
    'Finding codes (D-) describe the problems the provider addressed.',
    'Modifiers (M-) are added to a V- or P- code to change its meaning.',
  ],
} as const;

export const MANUAL_CODES: readonly ManualCode[] = [
  { code: 'V-110', kind: 'visit', meaning: 'Brief visit', when: 'Documented face-to-face time under 15 minutes' },
  { code: 'V-120', kind: 'visit', meaning: 'Standard visit', when: '15 to 29 minutes, or time not documented' },
  { code: 'V-130', kind: 'visit', meaning: 'Extended visit', when: '30 to 44 minutes' },
  { code: 'V-140', kind: 'visit', meaning: 'Comprehensive visit', when: '45 minutes or more' },
  { code: 'V-150', kind: 'visit', meaning: 'Telehealth visit', when: 'Any visit conducted by video or phone, regardless of time' },
  { code: 'V-200', kind: 'visit', meaning: 'Preventive (annual) visit', when: 'Scheduled wellness visit with no presenting complaint' },
  { code: 'V-300', kind: 'visit', meaning: 'Urgent same-day visit', when: 'Unscheduled visit for an acute problem' },
  { code: 'P-210', kind: 'procedure', meaning: 'Simple wound repair', when: 'Single-layer closure, wound 5 cm or less' },
  { code: 'P-220', kind: 'procedure', meaning: 'Complex wound repair', when: 'Layered closure, or wound longer than 5 cm' },
  { code: 'P-310', kind: 'procedure', meaning: 'Joint injection', when: 'Injection of medication into a joint space' },
  { code: 'P-320', kind: 'procedure', meaning: 'Skin lesion removal', when: 'Excision or shave removal of a skin lesion' },
  { code: 'P-330', kind: 'procedure', meaning: 'Fracture or sprain splinting', when: 'Application of a splint or immobilizer' },
  { code: 'P-410', kind: 'procedure', meaning: 'ECG', when: '12-lead electrocardiogram performed and read in clinic' },
  { code: 'P-420', kind: 'procedure', meaning: 'Spirometry', when: 'Lung function test performed in clinic' },
  { code: 'P-430', kind: 'procedure', meaning: 'Rapid strep test', when: 'Point-of-care throat swab test' },
  { code: 'D-101', kind: 'finding', meaning: 'High blood pressure' },
  { code: 'D-102', kind: 'finding', meaning: 'Type 2 diabetes' },
  { code: 'D-103', kind: 'finding', meaning: 'Upper respiratory infection' },
  { code: 'D-104', kind: 'finding', meaning: 'Low back pain' },
  { code: 'D-105', kind: 'finding', meaning: 'Anxiety' },
  { code: 'D-106', kind: 'finding', meaning: 'Laceration' },
  { code: 'D-107', kind: 'finding', meaning: 'Knee pain' },
  { code: 'D-108', kind: 'finding', meaning: 'Skin lesion' },
  { code: 'D-109', kind: 'finding', meaning: 'Asthma' },
  { code: 'D-110', kind: 'finding', meaning: 'Ankle sprain' },
  { code: 'D-111', kind: 'finding', meaning: 'Sore throat' },
  { code: 'D-112', kind: 'finding', meaning: 'Chest pain' },
  { code: 'D-113', kind: 'finding', meaning: 'Routine wellness, no complaint' },
  { code: 'D-114', kind: 'finding', meaning: 'Wrist sprain or suspected fracture' },
  { code: 'D-115', kind: 'finding', meaning: 'Headache' },
  { code: 'D-116', kind: 'finding', meaning: 'Medication refill / management' },
  { code: 'M-25', kind: 'modifier', meaning: 'Separate visit on procedure day', when: 'Appended to the visit code when a visit addressed a problem separate from the procedure performed the same day' },
  { code: 'M-52', kind: 'modifier', meaning: 'Reduced or incomplete procedure', when: 'Appended to a procedure code when the procedure was started but not completed' },
  { code: 'M-95', kind: 'modifier', meaning: 'Telehealth modifier', when: 'Used only where a payer requires it; see payer rules' },
];

export const MANUAL_RULES: readonly ManualRule[] = [
  { id: 'G1', text: 'Assign exactly one V- code per visit, except a visit whose only purpose was a scheduled procedure (see G6).' },
  { id: 'G2', text: 'Choose the V-110 / V-120 / V-130 / V-140 level from the face-to-face time written in the note: under 15 minutes is V-110, 15 to 29 is V-120, 30 to 44 is V-130, 45 or more is V-140. If the note does not say how long the visit took, assign V-120.' },
  { id: 'G3', text: 'Assign a P- code only when the note says the procedure was performed. A procedure that was discussed, offered, recommended, ordered, or declined is not coded.' },
  { id: 'G4', text: 'Assign a D- code for every problem the note addresses, main problem first, at most four.' },
  { id: 'G5', text: 'Any visit done by video or telephone is V-150, whatever its length. Do not add M-95.' },
  { id: 'G6', text: 'When a procedure is performed on the same day as a visit that addressed a separate problem, add M-25 to the V- code. When the visit was only for the procedure, assign the P- code and its D- code and no V- code.' },
  { id: 'G7', text: 'When a procedure was started but not finished, add M-52 to the P- code.' },
  { id: 'G8', text: 'A scheduled wellness visit with no specific complaint is V-200 with D-113. Ongoing problems reviewed during a wellness visit get their D- code but no second V- code.' },
  { id: 'G9', text: 'An unscheduled same-day visit for a new, urgent problem is V-300, whatever its length.' },
  { id: 'G10', text: 'Only codes in the table above may be assigned. If a note mentions a code that is not in the table, do not assign it; ask the provider what was meant.' },
  { id: 'G11', text: 'Every assigned code must be supported by words in the note.' },
];

/** Manual anchor for a code or a G-rule ("G6/HR-08" links to G6); null for Harborline (HR-xx) and anything else. */
export function manualHref(ref: string): string | null {
  const id = ref.split('/')[0].trim();
  if (MANUAL_CODES.some((c) => c.code === id) || MANUAL_RULES.some((r) => r.id === id)) return `/manual#${id}`;
  return null;
}

/** Case-insensitive text search over code, kind, meaning and when-it-applies, and over rule id and text. */
export function searchManual(q: string): { codes: ManualCode[]; rules: ManualRule[] } {
  const t = q.trim().toLowerCase();
  if (!t) return { codes: [...MANUAL_CODES], rules: [...MANUAL_RULES] };
  const has = (...xs: Array<string | undefined>) => xs.some((x) => x?.toLowerCase().includes(t));
  return {
    codes: MANUAL_CODES.filter((c) => has(c.code, c.kind, c.meaning, c.when)),
    rules: MANUAL_RULES.filter((r) => has(r.id, r.text)),
  };
}
