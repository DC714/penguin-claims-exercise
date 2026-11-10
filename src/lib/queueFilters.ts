/** Queue filters, kept in the URL. Pure so the server page and the client filter bar share it. */
export type Tile = 'denial' | 'review';
export interface QueueFilters { filter?: Tile; rule?: string; from?: string; to?: string; providers: string[] }
type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const RULE = /^(HR-\d{2}|WARN-[A-Z]+)$/;

/** A real calendar date as YYYY-MM-DD, compared as a string so no timezone ever shifts it. */
export function isoDate(v: string | undefined): string | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? v : undefined;
}

/**
 * Parse and validate the queue's search params. Tiles and rule are one at a time (a rule wins); the date
 * range and providers stack on top. Invalid dates and providers not in `knownProviders` are dropped.
 */
export function parseQueueParams(sp: Params, knownProviders: string[]): QueueFilters {
  const out: QueueFilters = { providers: [] };
  const rule = first(sp.rule);
  const tile = first(sp.filter) ?? (first(sp.risk) ? 'denial' : undefined);
  if (rule && RULE.test(rule)) out.rule = rule;
  else if (tile === 'denial' || tile === 'review') out.filter = tile;
  let from = isoDate(first(sp.from)), to = isoDate(first(sp.to));
  if (from || to) {
    from ??= to; to ??= from;
    if (from! > to!) [from, to] = [to, from];
    out.from = from; out.to = to;
  }
  const known = new Set(knownProviders);
  out.providers = [...new Set(all(sp.provider).filter((p) => known.has(p)))];
  return out;
}

export function queueHref(f: QueueFilters): string {
  const q = new URLSearchParams();
  if (f.rule) q.set('rule', f.rule); else if (f.filter) q.set('filter', f.filter);
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  for (const p of f.providers) q.append('provider', p);
  const s = q.toString();
  return s ? `/?${s}` : '/';
}
