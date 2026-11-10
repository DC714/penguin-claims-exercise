import { parseNote } from '../engine/parse';
import { suggestCodes, claimCodes } from '../engine/suggest';
import { checkDenials } from '../engine/denials';
import { parseDate } from '../engine/dates';
import { bodyKey, resolveMember } from '../ingest/resolve';
import type { Member, RawVisit } from '../ingest/load';
import type { DenialCtx, Flag, NotCoded, PriorAuth, Suggestion, Warning } from '../engine/types';

export interface VisitRecord {
  /** Encounter id from the source. The same encounter can come from the xlsx and a PDF, so it is not unique. */
  encId: string;
  /** Primary key in the database: the first copy keeps encId, later copies get a '~n' suffix. */
  dbId: string; sourceFile: string; provider?: string; dos: string; memberId?: string; resolveMethod: string; patientName?: string;
  note: string; minutes: number | null; duplicateOf?: string; warnings: Warning[]; needsEscalation: boolean; suggestions: Suggestion[]; notCoded: NotCoded[];
}
export interface World { members: Map<string, Member>; priorAuths: PriorAuth[]; visits: VisitRecord[] }
type Kind = { kind: 'denial' | 'warning' };

export function buildRecords(raws: RawVisit[], roster: Member[]): VisitRecord[] {
  const seen = new Map<string, string>();
  const used = new Map<string, number>();
  return raws.map((r) => {
    const copy = (used.get(r.encId) ?? 0) + 1; used.set(r.encId, copy);
    const n = parseNote(r.text);
    const res = resolveMember({ memberId: n.memberId ?? r.memberCol, name: n.patientName, dob: n.dob }, roster);
    const colDos = r.dosCol ? parseDate(r.dosCol) : null;
    const dos = colDos ?? n.dos ?? '';
    const eng = suggestCodes(r.text);
    const warnings = [...eng.warnings];
    if (colDos && n.dos && colDos !== n.dos) warnings.push({ kind: 'date_mismatch', message: `Spreadsheet date ${colDos} differs from note date ${n.dos}.` });
    if (!res.member) warnings.push({ kind: 'member_unresolved', message: `Member not resolved (${res.method}).` });
    const key = `${res.member?.memberId ?? n.patientName}|${dos}|${bodyKey(n.sentences)}`;
    const dup = seen.get(key);
    if (!dup) seen.set(key, r.encId);
    else warnings.push({ kind: 'duplicate', message: `Same note as ${dup}.` });
    return {
      encId: r.encId, dbId: copy === 1 ? r.encId : `${r.encId}~${copy}`, sourceFile: r.sourceFile, provider: r.provider || n.provider, dos, memberId: res.member?.memberId, resolveMethod: res.method, patientName: n.patientName,
      note: n.normalized, minutes: eng.minutes, duplicateOf: dup, warnings, needsEscalation: eng.needsEscalation || !res.member,
      suggestions: eng.suggestions, notCoded: eng.notCoded,
    };
  });
}

function denialCtx(rec: VisitRecord, world: World): DenialCtx {
  const member = rec.memberId ? world.members.get(rec.memberId) : undefined;
  // Other encounters of the member: not this encounter (any copy with the same enc id) and not duplicate notes.
  const others = world.visits
    .filter((v) => v.memberId && v.memberId === rec.memberId && v.encId !== rec.encId && !v.duplicateOf)
    .map((v) => ({ encId: v.encId, dos: v.dos, codes: claimCodes(v.suggestions) }));
  return { plan: member?.plan, memberId: rec.memberId, dos: rec.dos, minutes: rec.minutes, priorAuths: world.priorAuths, otherVisits: others };
}

/** Flags for a given claim (rules-v1, a model's or a coder's codes) on this visit. */
export function flagsFor(rec: VisitRecord, codes: string[], world: World): Array<Flag & Kind> {
  const member = rec.memberId ? world.members.get(rec.memberId) : undefined;
  const denials = checkDenials(codes, denialCtx(rec, world)).map((f) => ({ ...f, kind: 'denial' as const }));
  const warn: Array<Flag & Kind> = [];
  if (!member) warn.push({ ruleId: 'WARN-MEMBER', why: 'Member could not be matched to the Harborline roster; plan unknown so HR-01 was not checked.', fix: 'Confirm the member ID with the clinic.', kind: 'warning' });
  if (member && rec.resolveMethod === 'name') warn.push({
    ruleId: 'WARN-MEMBER',
    why: `Matched to ${member.memberId} (${member.first} ${member.last}, born ${member.dob}, ${member.plan} plan) by name only: the note gives neither a member number nor a birth date, so this could be a different member with the same name.`,
    fix: 'Ask Northgate to confirm the patient\'s birth date or member number before billing.',
    kind: 'warning',
  });
  if (member && member.effDt > rec.dos) warn.push({ ruleId: 'WARN-COVERAGE', why: `Coverage began ${member.effDt}, after the date of service ${rec.dos}.`, fix: 'Verify eligibility before billing.', kind: 'warning' });
  for (const w of rec.warnings.filter((x) => x.kind === 'injection' || x.kind === 'date_mismatch'))
    warn.push({ ruleId: w.kind === 'injection' ? 'WARN-INSTRUCTION' : 'WARN-DATE', why: w.message + (w.evidence ? ` "${w.evidence}"` : ''), fix: w.kind === 'injection' ? 'Review the note; the text was not used for coding.' : 'Check the date of service.', kind: 'warning' });
  return [...denials, ...warn];
}

/**
 * Flags for the rules-v1 claim. A low-confidence M-25 is only assumed (the procedure treats the same problem
 * as the visit, so G6 does not call for it), but it stops HR-08 from firing. Check the claim without it, so the
 * queue still counts the visit as a likely denial until a coder decides.
 */
export function rulesFlags(rec: VisitRecord, world: World): Array<Flag & Kind> {
  const codes = claimCodes(rec.suggestions);
  const flags = flagsFor(rec, codes, world);
  if (rec.suggestions.some((s) => s.code === 'M-25' && s.confidence === 'low')
    && checkDenials(codes.filter((c) => c !== 'M-25'), denialCtx(rec, world)).some((f) => f.ruleId === 'HR-08'))
    flags.unshift({
      ruleId: 'HR-08', kind: 'denial',
      why: 'M-25 is only assumed: the procedure treats the same problem as the visit, so the manual (G6) does not call for M-25, but Harborline denies the procedure without it.',
      fix: 'Coder to decide: confirm M-25 with the provider/payer or bill the procedure alone.',
    });
  return flags;
}
