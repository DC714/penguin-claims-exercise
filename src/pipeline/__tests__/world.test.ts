import { describe, it, expect } from 'vitest';
import { buildRecords, flagsFor, type World } from '../world';
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
});
