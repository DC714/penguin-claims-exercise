const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export const DATE_RE = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-[A-Za-z]{3}-\d{4}|[A-Za-z]{3} \d{1,2}, \d{4}/g;

function iso(y: number, m: number, d: number): string | null {
  if (!m || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDate(s: string): string | null {
  const t = s.trim().replace(/\.$/, '');
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return iso(+m[3], +m[1], +m[2]);
  if ((m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/))) return iso(+m[3], MON[m[2].toLowerCase()], +m[1]);
  if ((m = t.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}),? (\d{4})/))) return iso(+m[3], MON[m[1].toLowerCase()], +m[2]);
  return null;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
