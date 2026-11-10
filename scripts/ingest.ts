import { readFileSync } from 'node:fs';
import { sql } from '../src/lib/db';
import { loadXlsx, loadPdfs, loadRoster } from '../src/ingest/load';
import { buildRecords, flagsFor, type World } from '../src/pipeline/world';
import { claimCodes } from '../src/engine/suggest';


// Wrapped in main(): the package is CommonJS, so tsx cannot use top-level await here.
async function main() {
  const D = process.env.DATA_DIR ?? '../customer_materials';
  const { visits, coded } = await loadXlsx(`${D}/visits_export_2026-10-20.xlsx`);
  const roster = await loadRoster(`${D}/harborline_member_roster.csv`);
  const priorAuths = JSON.parse(readFileSync('data/prior_auths.json', 'utf8'));
  const recs = buildRecords([...visits, ...(await loadPdfs(`${D}/notes_pdf_batch2`))], roster);
  const world: World = { members: new Map(roster.map((m) => [m.memberId, m])), priorAuths, visits: recs };


  for (const stmt of readFileSync('db/schema.sql', 'utf8').split(';').filter((s) => s.trim())) await sql.query(stmt);
  // The same encounter can appear in both the xlsx and a PDF (same enc_id); the first keeps its id, later copies get a '~n' suffix so the PK stays unique.
  const used = new Map<string, number>();
  const dbId = new Map<(typeof recs)[number], string>();
  for (const r of recs) { const n = (used.get(r.encId) ?? 0) + 1; used.set(r.encId, n); dbId.set(r, n === 1 ? r.encId : `${r.encId}~${n}`); }
  const J = (rows: unknown[]) => JSON.stringify(rows);
  await sql`truncate reviews, denial_flags, not_coded, suggestions, coder_examples, visits, prior_auths, members restart identity cascade`;
  await sql`insert into members (member_id, last, first, dob, plan, eff_dt) select * from jsonb_to_recordset(${J(roster.map((m) => ({ member_id: m.memberId, last: m.last, first: m.first, dob: m.dob, plan: m.plan, eff_dt: m.effDt })))}::jsonb) as x(member_id text, last text, first text, dob date, plan text, eff_dt date)`;
  await sql`insert into prior_auths (auth_no, member_id, code, approved, expires) select * from jsonb_to_recordset(${J(priorAuths.map((a: any) => ({ auth_no: a.authNo, member_id: a.memberId, code: a.code, approved: a.approved, expires: a.expires })))}::jsonb) as x(auth_no text, member_id text, code text, approved date, expires date)`;
  await sql`insert into visits (enc_id, source_file, member_id, resolve_method, patient_name, dos, provider, note, minutes, duplicate_of, needs_escalation, warnings) select * from jsonb_to_recordset(${J(recs.map((r) => ({ enc_id: dbId.get(r), source_file: r.sourceFile, member_id: r.memberId ?? null, resolve_method: r.resolveMethod, patient_name: r.patientName ?? null, dos: r.dos || null, provider: r.provider ?? null, note: r.note, minutes: r.minutes, duplicate_of: r.duplicateOf ?? null, needs_escalation: r.needsEscalation, warnings: r.warnings })))}::jsonb) as x(enc_id text, source_file text, member_id text, resolve_method text, patient_name text, dos date, provider text, note text, minutes int, duplicate_of text, needs_escalation boolean, warnings jsonb)`;

  const sug: unknown[] = [], nc: unknown[] = [], fl: unknown[] = [];
  for (const r of recs) {
    for (const s of r.suggestions) sug.push({ enc_id: dbId.get(r), source: 'rules-v1', code: s.code, evidence: s.evidence, rule: s.rule, confidence: s.confidence, note: s.note ?? null });
    for (const n of r.notCoded) nc.push({ enc_id: dbId.get(r), source: 'rules-v1', code: n.code, evidence: n.evidence, reason: n.reason });
    for (const f of flagsFor(r, claimCodes(r.suggestions), world)) fl.push({ enc_id: dbId.get(r), source: 'rules-v1', rule_id: f.ruleId, why: f.why, fix: f.fix, kind: f.kind });
  }
  for (const ex of coded) {
    const r = recs.find((x) => x.encId === ex.encId && !x.duplicateOf); if (!r) continue;
    for (const f of flagsFor(r, ex.codes, world).filter((x) => x.kind === 'denial')) fl.push({ enc_id: dbId.get(r), source: `coder:${ex.coder}`, rule_id: f.ruleId, why: f.why, fix: f.fix, kind: 'denial' });
  }
  await sql`insert into suggestions (enc_id, source, code, evidence, rule, confidence, note) select * from jsonb_to_recordset(${J(sug)}::jsonb) as x(enc_id text, source text, code text, evidence text, rule text, confidence text, note text)`;
  await sql`insert into not_coded (enc_id, source, code, evidence, reason) select * from jsonb_to_recordset(${J(nc)}::jsonb) as x(enc_id text, source text, code text, evidence text, reason text)`;
  await sql`insert into denial_flags (enc_id, source, rule_id, why, fix, kind) select * from jsonb_to_recordset(${J(fl)}::jsonb) as x(enc_id text, source text, rule_id text, why text, fix text, kind text) on conflict do nothing`;
  await sql`insert into coder_examples (enc_id, codes, coder) select * from jsonb_to_recordset(${J(coded.map((c) => ({ enc_id: c.encId, codes: c.codes.join(', '), coder: c.coder })))}::jsonb) as x(enc_id text, codes text, coder text)`;

  const [c] = await sql`select (select count(*) from visits) v, (select count(*) from suggestions) s, (select count(*) from denial_flags) f`;
  console.log(c);

}
main().catch((e) => { console.error(e); process.exit(1); });
