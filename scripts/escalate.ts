import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { sql } from '../src/lib/db';
import { parseNote } from '../src/engine/parse';
import { claimCodes } from '../src/engine/suggest';
import { buildPrompt } from '../src/pipeline/escalatePrompt';
import { validateLlmCodes, modelLabel, pickModel } from '../src/pipeline/validate';
import { flagsFor } from '../src/pipeline/world';
import { loadWorld } from '../src/pipeline/build';

const MODEL = process.env.ESCALATE_MODEL ?? 'sonnet';
const LIMIT = Number(process.env.ESCALATE_LIMIT ?? 100);

/** The part of `claude -p --output-format json` output used here. */
interface ClaudeOut { result?: unknown; modelUsage?: Record<string, unknown> }

async function main() {
  // Empty temp dir: no project files, CLAUDE.md or settings for the model to read; tools are also disabled below.
  const cwd = mkdtempSync(`${tmpdir()}/escalate-`);
  // Same world as ingest (same records, ids and other-visit lists), so model flags are computed exactly like rules-v1 flags.
  const { world } = await loadWorld();
  const stored = new Map(((await sql`select enc_id, note from visits`) as Array<{ enc_id: string; note: string }>).map((v) => [v.enc_id, v.note]));
  const stale = world.visits.filter((r) => stored.get(r.dbId) !== r.note).map((r) => r.dbId);
  if (stale.length) throw new Error(`database is out of date with the source files (${stale.slice(0, 5).join(', ')}...); run npm run ingest first`);

  const todo = world.visits.filter((r) => r.needsEscalation && !r.duplicateOf).slice(0, LIMIT);
  console.log(`escalating ${todo.length} visits with model alias "${MODEL}"`);
  let nAccepted = 0, nRejected = 0, nFailed = 0;
  for (const r of todo) {
    const run = spawnSync('claude', ['-p', '--output-format', 'json', '--model', MODEL, '--tools', '', '--no-session-persistence', '--disable-slash-commands', '--strict-mcp-config'],
      { input: buildPrompt(r.note), cwd, encoding: 'utf8', maxBuffer: 20_000_000 });
    if (run.status !== 0) { console.error(r.dbId, 'claude failed', run.stderr.slice(0, 200)); nFailed++; continue; }
    let outer: ClaudeOut; try { outer = JSON.parse(run.stdout) as ClaudeOut; } catch { console.error(r.dbId, 'bad outer JSON'); nFailed++; continue; }
    const source = modelLabel(pickModel(outer.modelUsage, MODEL)); // throws if the answering model is ambiguous
    let items: Array<{ code: string; quote: string }> = [];
    try { items = (JSON.parse(String(outer.result).match(/\{[\s\S]*\}/)![0]) as { codes?: typeof items }).codes ?? []; } catch { console.error(r.dbId, 'could not parse model JSON'); nFailed++; continue; }
    const { accepted, rejected } = validateLlmCodes(r.note, parseNote(r.note).injected, items, claimCodes(r.suggestions));
    nAccepted += accepted.length; nRejected += rejected.length;
    if (rejected.length) console.log(r.dbId, source, 'rejected:', rejected.map((x) => `${x.code} (${x.why})`).join('; '));
    const flags = flagsFor({ ...r, suggestions: accepted }, claimCodes(accepted), world);
    await sql.transaction([
      sql`delete from suggestions where enc_id = ${r.dbId} and source = ${source}`,
      sql`delete from denial_flags where enc_id = ${r.dbId} and source = ${source}`,
      ...accepted.map((s) => sql`insert into suggestions (enc_id, source, code, evidence, rule, confidence) values (${r.dbId}, ${source}, ${s.code}, ${s.evidence}, ${s.rule}, ${s.confidence})`),
      ...flags.map((f) => sql`insert into denial_flags (enc_id, source, rule_id, why, fix, kind) values (${r.dbId}, ${source}, ${f.ruleId}, ${f.why}, ${f.fix}, ${f.kind}) on conflict do nothing`),
    ]);
    console.log(r.dbId, source, accepted.map((a) => a.code).join(','));
  }
  console.log(`done: escalated ${todo.length - nFailed}, failed ${nFailed}, accepted ${nAccepted}, rejected ${nRejected}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
