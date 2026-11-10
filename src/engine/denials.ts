import { daysBetween } from './dates';
import type { DenialCtx, Flag, PriorAuth } from './types';

const isV = (c: string) => c.startsWith('V-');
const isP = (c: string) => c.startsWith('P-');

export function toBillable(codes: string[]): string[] {
  const out: string[] = [];
  for (const c of codes) {
    if (c === 'V-150') { out.push('V-110'); if (!codes.includes('M-95')) out.push('M-95'); } else out.push(c);
  }
  return out;
}

export function checkDenials(codes: string[], ctx: DenialCtx): Flag[] {
  const f: Flag[] = [];
  const vs = codes.filter(isV);
  const ps = codes.filter(isP);

  // HR-01
  if (ctx.plan === 'Bronze') {
    for (const p of ps.filter((c) => ['P-310', 'P-320', 'P-330'].includes(c))) {
      const mine = ctx.priorAuths.filter((a) => a.memberId === ctx.memberId && a.code === p);
      if (mine.some((a) => a.approved <= ctx.dos && ctx.dos <= a.expires)) continue;
      let why = `${p} on a Bronze plan needs prior authorization; none on file for ${ctx.memberId}.`;
      // nearest approval to the date of service (0 when inside the window)
      const gap = (x: PriorAuth) => (ctx.dos < x.approved ? daysBetween(ctx.dos, x.approved) : ctx.dos > x.expires ? daysBetween(x.expires, ctx.dos) : 0);
      const a = [...mine].sort((x, y) => gap(x) - gap(y))[0];
      if (a) why = a.expires < ctx.dos
        ? `${a.authNo} for ${p} expired ${a.expires}, before date of service ${ctx.dos}.`
        : `${a.authNo} for ${p} was approved ${a.approved}, after date of service ${ctx.dos}.`;
      f.push({ ruleId: 'HR-01', why, fix: 'Obtain or renew the authorization before billing, or hold the procedure line.' });
    }
  }
  // HR-02
  if (codes.includes('V-150')) f.push({ ruleId: 'HR-02', why: 'Harborline does not recognize V-150; the whole claim is denied.', fix: 'Bill as V-110 + M-95.' });
  // HR-03
  const sameDay = ctx.otherVisits.filter((o) => o.dos === ctx.dos && o.codes.some(isV));
  if (vs.length > 1) f.push({ ruleId: 'HR-03', why: `Claim has ${vs.length} V- codes (${vs.join(', ')}).`, fix: 'Keep one V- code.' });
  else if (vs.length === 1 && sameDay.length)
    f.push({ ruleId: 'HR-03', why: `Same member has another visit on ${ctx.dos} (${sameDay.map((o) => o.encId).join(', ')}); only one V- code is paid per day.`, fix: 'Confirm whether these are one visit; if so bill a single V- code.' });
  // HR-04
  if (codes.includes('P-210') && codes.includes('P-220')) f.push({ ruleId: 'HR-04', why: 'P-210 and P-220 on the same claim.', fix: 'Keep only the repair that matches the wound.' });
  // HR-05
  if (codes.length && !vs.length && !ps.length) f.push({ ruleId: 'HR-05', why: 'Claim has only D- codes.', fix: 'Add the V- or P- code the note supports.' });
  // HR-06
  if (codes.includes('V-130') && !(ctx.minutes !== null && ctx.minutes >= 30))
    f.push({ ruleId: 'HR-06', why: `V-130 needs 30 documented minutes; note documents ${ctx.minutes ?? 'none'}. Paid at the V-120 rate.`, fix: 'Code V-120 unless the time is documented.' });
  if (codes.includes('V-140') && !(ctx.minutes !== null && ctx.minutes >= 45))
    f.push({ ruleId: 'HR-06', why: `V-140 needs 45 documented minutes; note documents ${ctx.minutes ?? 'none'}. Paid at the V-120 rate.`, fix: 'Code V-120 unless the time is documented.' });
  // HR-07
  if (codes.includes('V-200')) {
    const prev = ctx.otherVisits.find((o) => o.codes.includes('V-200') && o.dos < ctx.dos && daysBetween(o.dos, ctx.dos) <= 365);
    if (prev) f.push({ ruleId: 'HR-07', why: `Member already had a V-200 on ${prev.dos} (${prev.encId}), ${daysBetween(prev.dos, ctx.dos)} days earlier.`, fix: 'Code as a standard visit (V-120) with the D- codes.' });
  }
  // HR-08
  if (vs.length && ps.length && !codes.includes('M-25'))
    f.push({ ruleId: 'HR-08', why: 'V- code and P- code on the same claim without M-25; the P- code is denied.', fix: 'Add M-25 to the V- code if the visit addressed a separate problem.' });
  return f;
}
