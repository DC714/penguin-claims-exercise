import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { sql } from '../src/lib/db';
import { parseNote } from '../src/engine/parse';
import { claimCodes } from '../src/engine/suggest';
import { buildPrompt } from '../src/pipeline/escalatePrompt';
import { validateLlmCodes, modelLabel } from '../src/pipeline/validate';
import { flagsFor, type World, type VisitRecord } from '../src/pipeline/world';
import type { Member } from '../src/ingest/load';

const MODEL = process.env.ESCALATE_MODEL ?? 'sonnet';
const LIMIT = Number(process.env.ESCALATE_LIMIT ?? 100);

async function main() {
  // Empty temp dir: no project files, CLAUDE.md or settings for the model to read; tools are also disabled below.
  const cwd = mkdtempSync(`${tmpdir()}/escalate-`);
  const members = (await sql`select member_id as "memberId", last, first, dob::text as dob, plan, eff_dt::text as "effDt" from members`) as unknown as Member[];
  const priorAuths = (await sql`select auth_no as "authNo", member_id as "memberId", code, approved::text as approved, expires::text as expires from prior_auths`) as any[];
  const vrows = (await sql`select enc_id, source_file, provider, dos::text as dos, member_id, resolve_method, patient_name, note, minutes, duplicate_of, needs_escalation, warnings from visits where duplicate_of is null order by enc_id`) as any[];
  const rules = (await sql`select enc_id, code, evidence, rule, confidence, note from suggestions where source = 'rules-v1'`) as any[];
  const recs: VisitRecord[] = vrows.map((v) => ({
    encId: v.enc_id, sourceFile: v.source_file, provider: v.provider ?? undefined, dos: v.dos ?? '', memberId: v.member_id ?? undefined, resolveMethod: v.resolve_method,
    patientName: v.patient_name ?? undefined, note: v.note, minutes: v.minutes, duplicateOf: undefined, warnings: v.warnings ?? [], needsEscalation: v.needs_escalation,
    suggestions: rules.filter((r) => r.enc_id === v.enc_id).map((r) => ({ code: r.code, evidence: r.evidence, rule: r.rule, confidence: r.confidence, note: r.note ?? undefined })), notCoded: [],
  }));
  const world: World = { members: new Map(members.map((m) => [m.memberId, m])), priorAuths, visits: recs };

  const todo = recs.filter((r) => r.needsEscalation).slice(0, LIMIT);
  console.log(`escalating ${todo.length} visits with model alias "${MODEL}"`);
  let nAccepted = 0, nRejected = 0, nFailed = 0;
  for (const r of todo) {
    const run = spawnSync('claude', ['-p', '--output-format', 'json', '--model', MODEL, '--tools', '', '--no-session-persistence', '--disable-slash-commands', '--strict-mcp-config'],
      { input: buildPrompt(r.note), cwd, encoding: 'utf8', maxBuffer: 20_000_000 });
    if (run.status !== 0) { console.error(r.encId, 'claude failed', run.stderr.slice(0, 200)); nFailed++; continue; }
    let outer: any; try { outer = JSON.parse(run.stdout); } catch { console.error(r.encId, 'bad outer JSON'); nFailed++; continue; }
    const source = modelLabel(Object.keys(outer.modelUsage ?? {})[0] ?? MODEL);
    let items: Array<{ code: string; quote: string }> = [];
    try { items = JSON.parse(String(outer.result).match(/\{[\s\S]*\}/)![0]).codes ?? []; } catch { console.error(r.encId, 'could not parse model JSON'); nFailed++; continue; }
    const { accepted, rejected } = validateLlmCodes(r.note, parseNote(r.note).injected, items);
    nAccepted += accepted.length; nRejected += rejected.length;
    if (rejected.length) console.log(r.encId, source, 'rejected:', rejected.map((x) => `${x.code} (${x.why})`).join('; '));
    await sql`delete from suggestions where enc_id = ${r.encId} and source = ${source}`;
    await sql`delete from denial_flags where enc_id = ${r.encId} and source = ${source}`;
    for (const s of accepted) await sql`insert into suggestions (enc_id, source, code, evidence, rule, confidence) values (${r.encId}, ${source}, ${s.code}, ${s.evidence}, ${s.rule}, ${s.confidence})`;
    for (const f of flagsFor({ ...r, suggestions: accepted }, claimCodes(accepted), world))
      await sql`insert into denial_flags (enc_id, source, rule_id, why, fix, kind) values (${r.encId}, ${source}, ${f.ruleId}, ${f.why}, ${f.fix}, ${f.kind}) on conflict do nothing`;
    console.log(r.encId, source, accepted.map((a) => a.code).join(','));
  }
  console.log(`done: escalated ${todo.length - nFailed}, failed ${nFailed}, accepted ${nAccepted}, rejected ${nRejected}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
