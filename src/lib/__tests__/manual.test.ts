import { describe, it, expect } from 'vitest';
import { MANUAL_CODES, MANUAL_RULES, manualHref, searchManual } from '../manual';
import { CODES } from '../../engine/codes';
import { buildPrompt } from '../../pipeline/escalatePrompt';

describe('coding manual v3.2 data', () => {
  it('has every code of the manual: 7 V, 8 P, 16 D, 3 M, no duplicates', () => {
    const by = (k: string) => MANUAL_CODES.filter((c) => c.kind === k).map((c) => c.code);
    expect(by('visit')).toEqual(['V-110', 'V-120', 'V-130', 'V-140', 'V-150', 'V-200', 'V-300']);
    expect(by('procedure')).toEqual(['P-210', 'P-220', 'P-310', 'P-320', 'P-330', 'P-410', 'P-420', 'P-430']);
    expect(by('finding')).toEqual(Array.from({ length: 16 }, (_, i) => `D-${101 + i}`));
    expect(by('modifier')).toEqual(['M-25', 'M-52', 'M-95']);
    expect(new Set(MANUAL_CODES.map((c) => c.code)).size).toBe(34);
    for (const c of MANUAL_CODES) expect(c.code[0], c.code).toBe({ visit: 'V', procedure: 'P', finding: 'D', modifier: 'M' }[c.kind]);
  });
  it('has rules G1..G11 in order', () => {
    expect(MANUAL_RULES.map((r) => r.id)).toEqual(Array.from({ length: 11 }, (_, i) => `G${i + 1}`));
  });
  it('is the code set the validator and the model prompt use', () => {
    expect([...CODES].sort()).toEqual(MANUAL_CODES.map((c) => c.code).sort());
    const p = buildPrompt('x');
    for (const c of MANUAL_CODES) expect(p, c.code).toContain(`${c.code} ${c.meaning}`);
    for (const r of MANUAL_RULES) expect(p, r.id).toContain(`${r.id}. ${r.text}`);
  });
});
describe('manualHref', () => {
  it('links codes and G rules, not Harborline rules or llm', () => {
    expect(manualHref('V-150')).toBe('/manual#V-150');
    expect(manualHref('G4')).toBe('/manual#G4');
    expect(manualHref('G6/HR-08')).toBe('/manual#G6');
    expect(manualHref('HR-02')).toBeNull();
    expect(manualHref('llm')).toBeNull();
    expect(manualHref('G12')).toBeNull();
  });
});
describe('searchManual', () => {
  it('filters codes and rules by text, case-insensitively; empty query returns everything', () => {
    expect(searchManual('').codes.length).toBe(34);
    const t = searchManual('TELEHEALTH');
    expect(t.codes.map((c) => c.code)).toEqual(['V-150', 'M-95']);
    expect(searchManual('video').rules.map((r) => r.id)).toEqual(['G5']);
    expect(searchManual('splint').codes.map((c) => c.code)).toEqual(['P-330']);
    expect(searchManual('zzz')).toEqual({ codes: [], rules: [] });
  });
});
