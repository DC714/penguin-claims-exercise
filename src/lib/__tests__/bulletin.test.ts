import { describe, it, expect } from 'vitest';
import { BULLETIN_RULES, bulletinHref, searchBulletin } from '../bulletin';
import { ruleHref } from '../ruleLinks';

describe('Harborline bulletin 2026-07 data', () => {
  it('has HR-01..HR-08 in order, each with text and a tool note', () => {
    expect(BULLETIN_RULES.map((r) => r.id)).toEqual(['HR-01', 'HR-02', 'HR-03', 'HR-04', 'HR-05', 'HR-06', 'HR-07', 'HR-08']);
    for (const r of BULLETIN_RULES) { expect(r.text.length, r.id).toBeGreaterThan(40); expect(r.inTool.length, r.id).toBeGreaterThan(20); }
  });
  it('links HR ids only', () => {
    expect(bulletinHref('HR-02')).toBe('/bulletin#HR-02');
    expect(bulletinHref('HR-09')).toBeNull();
    expect(bulletinHref('WARN-MEMBER')).toBeNull();
  });
  it('searches rule text and notes', () => {
    expect(searchBulletin('').length).toBe(8);
    expect(searchBulletin('prior authorization').map((r) => r.id)).toEqual(['HR-01']);
    expect(searchBulletin('365').map((r) => r.id)).toEqual(['HR-07']);
  });
});
describe('ruleHref', () => {
  it('sends codes and G rules to the manual, HR rules to the bulletin, and leaves the rest unlinked', () => {
    expect(ruleHref('G6/HR-08')).toBe('/manual#G6');
    expect(ruleHref('D-107')).toBe('/manual#D-107');
    expect(ruleHref('HR-08')).toBe('/bulletin#HR-08');
    expect(ruleHref('WARN-INSTRUCTION')).toBeNull();
    expect(ruleHref('llm')).toBeNull();
  });
});
