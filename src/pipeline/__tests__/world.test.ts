import { describe, it, expect } from 'vitest';
import { buildRecords, flagsFor, rulesFlags, type World } from '../world';
import { claimCodes } from '../../engine/suggest';
import type { Member } from '../../ingest/load';
import prior from '../../../data/prior_auths.json';

const roster: Member[] = [
  { memberId: 'M-100264', last: 'KHAN', first: 'ROSA', dob: '1970-01-01', plan: 'Bronze', effDt: '2025-01-01' },
  { memberId: 'M-100379', last: 'CHEN', first: 'INGRID', dob: '1967-11-22', plan: 'Silver', effDt: '2026-09-01' },
];
const raw = (encId: string, text: string) => ({ encId, sourceFile: 'x', text });
const world = (recs: ReturnType<typeof buildRecords>): World => ({ members: new Map(roster.map((m) => [m.memberId, m])), priorAuths: prior, visits: recs });

describe('pipeline', () => {
  it('resolves by name+DOB and marks the second export of the same note as a duplicate', () => {
    const t = 'Patient: Ingrid Chen, DOB 11/22/1967\nDate: 2026-08-20\nProvider: NP J. Whitaker\nS/O: Same-day add-on, walked in with acute complaint. Low back pain: paraspinal tenderness, no red flags.';
    const recs = buildRecords([raw('E-51008', t), raw('E-50542', t)], roster);
    expect(recs[0].memberId).toBe('M-100379');
    expect(recs[0].resolveMethod).toBe('name+dob');
    expect(recs[1].duplicateOf).toBe('E-51008');
  });
  it('flags HR-01 and coverage warning', () => {
    const t = 'Member ID: M-100264\nDate: 10/20/2026\nS/O: Here for removal of 7 mm pigmented lesion on left forearm. Shave excision performed, hemostasis achieved. No other problems addressed today.';
    const recs = buildRecords([raw('E-1', t)], roster);
    const fl = flagsFor(recs[0], ['P-320', 'D-108'], world(recs));
    expect(fl.map((f) => f.ruleId)).toContain('HR-01');
  });
  it('warns when coverage began after the date of service', () => {
    const t = 'Patient: Ingrid Chen, DOB 11/22/1967\nDate: 2026-08-20\nS/O: Office visit. Low back pain: paraspinal tenderness. Time 15m.';
    const recs = buildRecords([raw('E-2', t)], roster);
    expect(flagsFor(recs[0], ['V-120', 'D-104'], world(recs)).some((f) => f.ruleId === 'WARN-COVERAGE')).toBe(true);
  });
  it('a low-confidence M-25 still surfaces HR-08 as a likely denial (strep test on a sore-throat visit)', () => {
    const t = 'Member ID: M-100264\nDate: 2026-07-09\nS/O: Same-day add-on, walked in with acute complaint. Sore throat: erythematous pharynx, tonsillar exudate, afebrile. Rapid strep performed, positive, started amoxicillin.';
    const recs = buildRecords([raw('E-50236', t)], roster);
    expect(claimCodes(recs[0].suggestions)).toEqual(['V-300', 'M-25', 'P-430', 'D-111']);
    const hr08 = rulesFlags(recs[0], world(recs)).filter((f) => f.ruleId === 'HR-08');
    expect(hr08).toHaveLength(1);
    expect(hr08[0].kind).toBe('denial');
    expect(hr08[0].why).toMatch(/only assumed/);
    // a coder claim with M-25, or a high-confidence M-25, is not second-guessed
    expect(flagsFor(recs[0], ['V-300', 'M-25', 'P-430', 'D-111'], world(recs)).some((f) => f.ruleId === 'HR-08')).toBe(false);
    const sep = buildRecords([raw('E-3', 'Member ID: M-100264\nDate: 2026-07-09\nS/O: Office visit. Hypertension: BP 130/80. Sore throat: exudate. Rapid strep performed, positive. Time 20m.')], roster);
    expect(rulesFlags(sep[0], world(sep)).some((f) => f.ruleId === 'HR-08')).toBe(false);
  });
  it('gives later copies of an encounter a ~n database id and never checks a copy against itself (HR-03)', () => {
    const a = 'Member ID: M-100264\nDate: 2026-07-09\nS/O: Office visit. Hypertension: BP 130/80. Time 20m.';
    const b = 'Member ID: M-100264\nDate: 2026-07-09\nS/O: Office visit. Hypertension: BP 130/80, recheck. Time 20m.';
    const recs = buildRecords([raw('E-9', a), raw('E-9', b), raw('E-10', a.replace('130/80', '128/80'))], roster);
    expect(recs.map((r) => r.dbId)).toEqual(['E-9', 'E-9~2', 'E-10']);
    const hr03 = rulesFlags(recs[1], world(recs)).filter((f) => f.ruleId === 'HR-03');
    expect(hr03).toHaveLength(1);
    expect(hr03[0].why).toContain('E-10');
    expect(hr03[0].why).not.toContain('E-9');
  });
  it('warns to confirm the member when the match was by name only', () => {
    const t = 'Patient: Ingrid Chen\nDate: 2026-10-20\nS/O: Office visit. Low back pain: paraspinal tenderness. Time 15m.';
    const recs = buildRecords([raw('E-3', t)], roster);
    expect(recs[0].resolveMethod).toBe('name');
    const w = flagsFor(recs[0], ['V-120', 'D-104'], world(recs)).find((f) => f.ruleId === 'WARN-MEMBER');
    expect(w?.kind).toBe('warning');
    expect(w?.why).toMatch(/by name only/);
    expect(w?.fix).toMatch(/birth date or member number/);
  });
  it('does not raise the member warning when the member id or name+DOB matched', () => {
    const t = 'Patient: Ingrid Chen, DOB 11/22/1967\nDate: 2026-10-20\nS/O: Office visit. Low back pain: paraspinal tenderness. Time 15m.';
    const recs = buildRecords([raw('E-4', t), raw('E-5', 'Member ID: M-100264\nDate: 10/20/2026\nS/O: Office visit. Headache: tension-type pattern. Time 15m.')], roster);
    for (const r of recs) expect(flagsFor(r, ['V-120'], world(recs)).some((f) => f.ruleId === 'WARN-MEMBER')).toBe(false);
  });
});

