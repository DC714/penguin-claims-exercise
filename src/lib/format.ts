export function day(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d ?? '').slice(0, 10);
}
export const visitHref = (enc: string) => `/visits/${encodeURIComponent(enc)}`;
