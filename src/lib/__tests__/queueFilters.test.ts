import { describe, it, expect } from 'vitest';
import { parseQueueParams, queueHref } from '../queueFilters';

const P = ['Dr. S. Varga', 'NP J. Whitaker'];
describe('parseQueueParams', () => {
  it('reads tile, rule, date range and providers', () => {
    expect(parseQueueParams({ filter: 'denial', from: '2026-08-01', to: '2026-08-31', provider: ['Dr. S. Varga', 'NP J. Whitaker'] }, P))
      .toEqual({ filter: 'denial', from: '2026-08-01', to: '2026-08-31', providers: ['Dr. S. Varga', 'NP J. Whitaker'] });
  });
  it('one tile or rule at a time: a rule wins over a tile', () => {
    expect(parseQueueParams({ filter: 'review', rule: 'HR-02' }, P)).toEqual({ rule: 'HR-02', providers: [] });
  });
  it('maps the old ?risk=1 link to the denial tile', () => {
    expect(parseQueueParams({ risk: '1' }, P)).toEqual({ filter: 'denial', providers: [] });
  });
  it('ignores invalid dates, unknown providers, unknown tiles and malformed rules', () => {
    expect(parseQueueParams({ filter: 'x', rule: "HR-02'; drop", from: '2026-02-30', to: 'yesterday', provider: ['Dr. Nobody', 'NP J. Whitaker'] }, P))
      .toEqual({ providers: ['NP J. Whitaker'] });
  });
  it('a lone From is that single day; From after To is swapped', () => {
    expect(parseQueueParams({ from: '2026-08-05' }, P)).toEqual({ from: '2026-08-05', to: '2026-08-05', providers: [] });
    expect(parseQueueParams({ to: '2026-08-05' }, P)).toEqual({ from: '2026-08-05', to: '2026-08-05', providers: [] });
    expect(parseQueueParams({ from: '2026-08-31', to: '2026-08-01' }, P)).toEqual({ from: '2026-08-01', to: '2026-08-31', providers: [] });
  });
  it('takes the first value when a single-value param repeats', () => {
    expect(parseQueueParams({ filter: ['denial', 'review'] }, P)).toEqual({ filter: 'denial', providers: [] });
  });
});
describe('queueHref', () => {
  it('builds a URL with repeated provider params and drops empty values', () => {
    expect(queueHref({ filter: 'denial', providers: ['Dr. S. Varga', 'NP J. Whitaker'] })).toBe('/?filter=denial&provider=Dr.+S.+Varga&provider=NP+J.+Whitaker');
    expect(queueHref({ providers: [] })).toBe('/');
    expect(queueHref({ rule: 'HR-08', from: '2026-08-01', to: '2026-08-01', providers: [] })).toBe('/?rule=HR-08&from=2026-08-01&to=2026-08-01');
  });
});
