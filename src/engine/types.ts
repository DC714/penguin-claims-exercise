export type Plan = 'Bronze' | 'Silver' | 'Gold';
export interface Suggestion { code: string; evidence: string; rule: string; confidence: 'high' | 'low'; note?: string }
export interface NotCoded { code: string; evidence: string; reason: string }
export type WarningKind = 'injection' | 'no_dx' | 'too_many_dx' | 'no_codes' | 'date_mismatch' | 'member_unresolved' | 'coverage' | 'duplicate';
export interface Warning { kind: WarningKind; message: string; evidence?: string }
export interface ParsedNote { normalized: string; memberId?: string; patientName?: string; dob?: string; dos?: string; sentences: string[]; injected: string[] }
export interface EngineResult { suggestions: Suggestion[]; notCoded: NotCoded[]; warnings: Warning[]; minutes: number | null; needsEscalation: boolean }
export interface PriorAuth { authNo: string; memberId: string; code: string; approved: string; expires: string }
export interface OtherVisit { encId: string; dos: string; codes: string[] }
export interface DenialCtx {
  plan?: Plan; dos: string; memberId?: string; minutes: number | null; priorAuths: PriorAuth[];
  /** The member's OTHER encounters. Callers MUST exclude the encounter being checked, or HR-03/HR-07 fire against itself. */
  otherVisits: OtherVisit[];
}
export interface Flag { ruleId: string; why: string; fix: string }
