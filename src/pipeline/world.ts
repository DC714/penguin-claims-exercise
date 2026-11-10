import { parseNote } from '../engine/parse';
import { suggestCodes, claimCodes } from '../engine/suggest';
import { checkDenials } from '../engine/denials';
import { parseDate } from '../engine/dates';
import { bodyKey, resolveMember } from '../ingest/resolve';
import type { Member, RawVisit } from '../ingest/load';
import type { Flag, NotCoded, PriorAuth, Suggestion, Warning } from '../engine/types';

export interface VisitRecord {
  encId: string; sourceFile: string; provider?: string; dos: string; memberId?: string; resolveMethod: string; patientName?: string;
  note: string; minutes: number | null; duplicateOf?: string; warnings: Warning[]; needsEscalation: boolean; suggestions: Suggestion[]; notCoded: NotCoded[];
}
export interface World { members: Map<string, Member>; priorAuths: PriorAuth[]; visits: VisitRecord[] }
type Kind = { kind: 'denial' | 'warning' };

export function buildRecords(raws: RawVisit[], roster: Member[]): VisitRecord[] {
  const seen = new Map<string, string>();
  return raws.map((r) => {
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
      encId: r.encId, sourceFile: r.sourceFile, provider: r.provider, dos, memberId: res.member?.memberId, resolveMethod: res.method, patientName: n.patientName,
      note: n.normalized, minutes: eng.minutes, duplicateOf: dup, warnings, needsEscalation: eng.needsEscalation || !res.member,
      suggestions: eng.suggestions, notCoded: eng.notCoded,
    };
  });
}

export function flagsFor(rec: VisitRecord, codes: string[], world: World): Array<Flag & Kind> {
  const member = rec.memberId ? world.members.get(rec.memberId) : undefined;
  const others = world.visits
    .filter((v) => v.memberId && v.memberId === rec.memberId && v.encId !== rec.encId && !v.duplicateOf)
    .map((v) => ({ encId: v.encId, dos: v.dos, codes: claimCodes(v.suggestions) }));
  const denials = checkDenials(codes, { plan: member?.plan, memberId: rec.memberId, dos: rec.dos, minutes: rec.minutes, priorAuths: world.priorAuths, otherVisits: others })
    .map((f) => ({ ...f, kind: 'denial' as const }));
  const warn: Array<Flag & Kind> = [];
  if (!member) warn.push({ ruleId: 'WARN-MEMBER', why: 'Member could not be matched to the Harborline roster; plan unknown so HR-01 was not checked.', fix: 'Confirm the member ID with the clinic.', kind: 'warning' });
  else if (member.effDt > rec.dos) warn.push({ ruleId: 'WARN-COVERAGE', why: `Coverage began ${member.effDt}, after the date of service ${rec.dos}.`, fix: 'Verify eligibility before billing.', kind: 'warning' });
  for (const w of rec.warnings.filter((x) => x.kind === 'injection' || x.kind === 'date_mismatch'))
    warn.push({ ruleId: w.kind === 'injection' ? 'WARN-INSTRUCTION' : 'WARN-DATE', why: w.message + (w.evidence ? ` "${w.evidence}"` : ''), fix: w.kind === 'injection' ? 'Review the note; the text was not used for coding.' : 'Check the date of service.', kind: 'warning' });
  return [...denials, ...warn];
}
