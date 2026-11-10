import { describe, it, expect } from 'vitest';
import { resolveMember } from '../resolve';
import type { Member } from '../load';

const R: Member[] = [
  { memberId: 'M-1', last: 'BERGSTRÖM', first: 'GRACE', dob: '1976-10-11', plan: 'Silver', effDt: '2025-02-01' },
  { memberId: 'M-2', last: 'DELGADO', first: 'MARIA', dob: '1979-03-14', plan: 'Bronze', effDt: '2025-02-01' },
  { memberId: 'M-3', last: 'DELGADO', first: 'MARIA', dob: '1960-01-01', plan: 'Gold', effDt: '2025-02-01' },
];
describe('resolveMember', () => {
  it('by id', () => expect(resolveMember({ memberId: 'M-1' }, R).member?.memberId).toBe('M-1'));
  it('name + dob disambiguates', () => expect(resolveMember({ name: 'Maria Delgado', dob: '1979-03-14' }, R)).toMatchObject({ method: 'name+dob', member: { memberId: 'M-2' } }));
  it('name only is ambiguous when two members share it', () => expect(resolveMember({ name: 'Maria Delgado' }, R).method).toBe('ambiguous'));
  it('accents and case are normalised', () => expect(resolveMember({ name: 'Grace Bergstrom' }, R).member?.memberId).toBe('M-1'));
  it('unknown', () => expect(resolveMember({ name: 'Nobody Here' }, R).method).toBe('none'));
});
