import { describe, it, expect } from 'vitest';
import { checkDenials, toBillable } from '../denials';
import prior from '../../../data/prior_auths.json';
import type { DenialCtx } from '../types';

const base = (o: Partial<DenialCtx> = {}): DenialCtx => ({ dos: '2026-08-01', minutes: null, priorAuths: prior, otherVisits: [], ...o });
const ids = (codes: string[], ctx: DenialCtx) => checkDenials(codes, ctx).map((f) => f.ruleId);

describe('checkDenials', () => {
  it('HR-01: Bronze needs a valid approval on the date of service', () => {
    const c = (dos: string, member = 'M-100264') => base({ plan: 'Bronze', memberId: member, dos });
    expect(ids(['P-320', 'D-108'], c('2026-08-01'))).toEqual([]);                 // PA-735688 valid
    expect(ids(['P-320', 'D-108'], c('2026-10-20'))).toEqual(['HR-01']);          // expired 10/16
    expect(ids(['P-320', 'D-108'], c('2026-07-01'))).toEqual(['HR-01']);          // approved 07/21, too early
    expect(ids(['P-310', 'D-107'], c('2026-08-01'))).toEqual(['HR-01']);          // wrong procedure
    expect(ids(['P-320', 'D-108'], { ...c('2026-08-01'), plan: 'Silver' })).toEqual([]);
  });
  it('HR-01 explains why', () => {
    const f = checkDenials(['P-320'], base({ plan: 'Bronze', memberId: 'M-100264', dos: '2026-10-20' }))[0];
    expect(f.why).toMatch(/PA-735688.*expired 2026-10-16/);
  });
  it('HR-02: V-150 denied, fix is V-110 + M-95', () => {
    const f = checkDenials(['V-150', 'D-101'], base())[0];
    expect(f.ruleId).toBe('HR-02');
    expect(f.fix).toMatch(/V-110 \+ M-95/);
    expect(toBillable(['V-150', 'D-101'])).toEqual(['V-110', 'M-95', 'D-101']);
  });
  it('HR-03: two V codes, or another visit the same day', () => {
    expect(ids(['V-120', 'V-130', 'D-101'], base())).toContain('HR-03');
    expect(ids(['V-120', 'D-101'], base({ otherVisits: [{ encId: 'E-1', dos: '2026-08-01', codes: ['V-120'] }] }))).toContain('HR-03');
    expect(ids(['V-120', 'D-101'], base({ otherVisits: [{ encId: 'E-1', dos: '2026-07-31', codes: ['V-120'] }] }))).not.toContain('HR-03');
  });
  it('HR-04, HR-05', () => {
    expect(ids(['P-210', 'P-220', 'D-106'], base())).toContain('HR-04');
    expect(ids(['D-101'], base())).toEqual(['HR-05']);
  });
  it('HR-06: V-130/V-140 need documented minutes', () => {
    expect(ids(['V-130', 'D-101'], base({ minutes: 20 }))).toContain('HR-06');
    expect(ids(['V-130', 'D-101'], base({ minutes: 30 }))).not.toContain('HR-06');
    expect(ids(['V-140', 'D-101'], base({ minutes: null }))).toContain('HR-06');
  });
  it('HR-07: second V-200 within 365 days', () => {
    const o = { encId: 'E-9', dos: '2026-03-01', codes: ['V-200'] };
    expect(ids(['V-200', 'D-113'], base({ otherVisits: [o] }))).toContain('HR-07');
    expect(ids(['V-200', 'D-113'], base({ otherVisits: [{ ...o, dos: '2025-01-01' }] }))).not.toContain('HR-07');
  });
  it('HR-08: V with P needs M-25', () => {
    expect(ids(['V-120', 'P-430', 'D-111'], base())).toContain('HR-08');
    expect(ids(['V-120', 'M-25', 'P-430', 'D-111'], base())).not.toContain('HR-08');
  });
  it('HR-01 boundaries: approved == dos and expires == dos are valid', () => {
    const a = (o: object) => base({ plan: 'Bronze', memberId: 'M-1', dos: '2026-08-01', priorAuths: [{ authNo: 'PA-1', memberId: 'M-1', code: 'P-320', approved: '2026-08-01', expires: '2026-09-01', ...o }] });
    expect(ids(['P-320'], a({}))).toEqual([]);
    expect(ids(['P-320'], a({ approved: '2026-07-01', expires: '2026-08-01' }))).toEqual([]);
    expect(ids(['P-320'], a({ approved: '2026-08-02' }))).toEqual(['HR-01']);
  });
  it('HR-01 cites the approval nearest the date of service', () => {
    const pa = (authNo: string, approved: string, expires: string) => ({ authNo, memberId: 'M-1', code: 'P-320', approved, expires });
    const ctx = base({ plan: 'Bronze', memberId: 'M-1', dos: '2026-08-01', priorAuths: [pa('PA-OLD', '2025-01-01', '2025-02-01'), pa('PA-NEAR', '2026-06-01', '2026-07-20')] });
    expect(checkDenials(['P-320'], ctx)[0].why).toMatch(/PA-NEAR/);
  });
  it('HR-03: another same-day visit with no V code does not trigger', () => {
    expect(ids(['V-120', 'D-101'], base({ otherVisits: [{ encId: 'E-1', dos: '2026-08-01', codes: ['P-430', 'D-111'] }] }))).not.toContain('HR-03');
  });
  it('HR-08: V-150 with a P- code triggers', () => {
    expect(ids(['V-150', 'P-430', 'D-111'], base())).toContain('HR-08');
  });
});
