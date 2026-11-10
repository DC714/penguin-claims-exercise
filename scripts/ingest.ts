import { readFileSync } from 'node:fs';
import { sql } from '../src/lib/db';
import { rulesFlags, flagsFor } from '../src/pipeline/world';
import { loadWorld } from '../src/pipeline/build';

/**
 * Re-runnable ingest. What it replaces and what it keeps:
 * - members, prior_auths, coder_examples: replaced from the source files.
 * - visits: upserted by enc_id; visits no longer in the sources are deleted with all their suggestions/flags.
 * - suggestions, not_coded, denial_flags: rows from source 'rules-v1' and 'coder:*' are regenerated.
 *   Rows from any other source (model escalation, e.g. 'sonnet-5.5') are kept, unless the visit's note text
 *   changed, in which case they were computed on a different note and are deleted (re-run escalate).
 * - reviews: never touched. They key on (enc_id, source, code), so a review stays attached to its code.
 * Everything after the schema step runs in one transaction.
 */
// Wrapped in main(): the package is CommonJS, so tsx cannot use top-level await here.
async function main() {
  const { world, coded } = await loadWorld();
  const recs = world.visits;
  for (const stmt of readFileSync('db/schema.sql', 'utf8').split(';').filter((s) => s.trim())) await sql.query(stmt);

  const before = new Map(((await sql`select enc_id, note from visits`) as Array<{ enc_id: string; note: string }>).map((v) => [v.enc_id, v.note]));
  const ids = recs.map((r) => r.dbId);
  const changed = recs.filter((r) => before.has(r.dbId) && before.get(r.dbId) !== r.note).map((r) => r.dbId);

  const sug: object[] = [], nc: object[] = [], fl: object[] = [];
  for (const r of recs) {
    for (const s of r.suggestions) sug.push({ enc_id: r.dbId, source: 'rules-v1', code: s.code, evidence: s.evidence, rule: s.rule, confidence: s.confidence, note: s.note ?? null });
    for (const n of r.notCoded) nc.push({ enc_id: r.dbId, source: 'rules-v1', code: n.code, evidence: n.evidence, reason: n.reason });
    for (const f of rulesFlags(r, world)) fl.push({ enc_id: r.dbId, source: 'rules-v1', rule_id: f.ruleId, why: f.why, fix: f.fix, kind: f.kind });
  }
  for (const ex of coded) {
    const r = recs.find((x) => x.encId === ex.encId && !x.duplicateOf); if (!r) continue;
    for (const f of flagsFor(r, ex.codes, world).filter((x) => x.kind === 'denial')) fl.push({ enc_id: r.dbId, source: `coder:${ex.coder}`, rule_id: f.ruleId, why: f.why, fix: f.fix, kind: 'denial' });
  }
  const J = (rows: unknown[]) => JSON.stringify(rows);
  const regenerated = `source = 'rules-v1' or source like 'coder:%'`;
  await sql.transaction([
    sql`delete from members`,
    sql`insert into members (member_id, last, first, dob, plan, eff_dt) select * from jsonb_to_recordset(${J([...world.members.values()].map((m) => ({ member_id: m.memberId, last: m.last, first: m.first, dob: m.dob, plan: m.plan, eff_dt: m.effDt })))}::jsonb) as x(member_id text, last text, first text, dob date, plan text, eff_dt date)`,
    sql`delete from prior_auths`,
    sql`insert into prior_auths (auth_no, member_id, code, approved, expires) select * from jsonb_to_recordset(${J(world.priorAuths.map((a) => ({ auth_no: a.authNo, member_id: a.memberId, code: a.code, approved: a.approved, expires: a.expires })))}::jsonb) as x(auth_no text, member_id text, code text, approved date, expires date)`,
    // visits that left the sources: drop their rows first (foreign keys), then the visit
    ...['suggestions', 'not_coded', 'denial_flags'].map((t) => sql.query(`delete from ${t} where not (enc_id = any($1::text[]))`, [ids])),
    sql`delete from visits where not (enc_id = any(${ids}::text[]))`,
    // visits whose note changed: model rows are stale
    ...['suggestions', 'not_coded', 'denial_flags'].map((t) => sql.query(`delete from ${t} where enc_id = any($1::text[])`, [changed])),
    ...['suggestions', 'not_coded', 'denial_flags'].map((t) => sql.query(`delete from ${t} where ${regenerated}`)),
    sql`insert into visits (enc_id, source_file, member_id, resolve_method, patient_name, dos, provider, note, minutes, duplicate_of, needs_escalation, warnings)
        select * from jsonb_to_recordset(${J(recs.map((r) => ({ enc_id: r.dbId, source_file: r.sourceFile, member_id: r.memberId ?? null, resolve_method: r.resolveMethod, patient_name: r.patientName ?? null, dos: r.dos || null, provider: r.provider ?? null, note: r.note, minutes: r.minutes, duplicate_of: r.duplicateOf ?? null, needs_escalation: r.needsEscalation, warnings: r.warnings })))}::jsonb)
          as x(enc_id text, source_file text, member_id text, resolve_method text, patient_name text, dos date, provider text, note text, minutes int, duplicate_of text, needs_escalation boolean, warnings jsonb)
        on conflict (enc_id) do update set source_file = excluded.source_file, member_id = excluded.member_id, resolve_method = excluded.resolve_method, patient_name = excluded.patient_name,
          dos = excluded.dos, provider = excluded.provider, note = excluded.note, minutes = excluded.minutes, duplicate_of = excluded.duplicate_of, needs_escalation = excluded.needs_escalation, warnings = excluded.warnings`,
    sql`insert into suggestions (enc_id, source, code, evidence, rule, confidence, note) select * from jsonb_to_recordset(${J(sug)}::jsonb) as x(enc_id text, source text, code text, evidence text, rule text, confidence text, note text)`,
    sql`insert into not_coded (enc_id, source, code, evidence, reason) select * from jsonb_to_recordset(${J(nc)}::jsonb) as x(enc_id text, source text, code text, evidence text, reason text)`,
    sql`insert into denial_flags (enc_id, source, rule_id, why, fix, kind) select * from jsonb_to_recordset(${J(fl)}::jsonb) as x(enc_id text, source text, rule_id text, why text, fix text, kind text) on conflict do nothing`,
    sql`delete from coder_examples`,
    sql`insert into coder_examples (enc_id, codes, coder) select * from jsonb_to_recordset(${J(coded.map((c) => ({ enc_id: c.encId, codes: c.codes.join(', '), coder: c.coder })))}::jsonb) as x(enc_id text, codes text, coder text)`,
  ]);

  const [c] = await sql`select (select count(*) from visits) v, (select count(*) from suggestions) s, (select count(*) from denial_flags) f, (select count(*) from reviews) r`;
  console.log(c, `note changed for ${changed.length} visits`);
}
main().catch((e) => { console.error(e); process.exit(1); });
