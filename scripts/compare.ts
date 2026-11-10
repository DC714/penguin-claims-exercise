import { loadXlsx, loadPdfs, loadRoster } from '../src/ingest/load';
import { buildRecords, flagsFor, type World } from '../src/pipeline/world';
import { claimCodes } from '../src/engine/suggest';
import { toBillable } from '../src/engine/denials';
import { readFileSync } from 'node:fs';

// Wrapped in main(): the package is CommonJS, so tsx cannot use top-level await here.
async function main() {
  const D = process.env.DATA_DIR ?? '../customer_materials';
  const { visits, coded } = await loadXlsx(`${D}/visits_export_2026-10-20.xlsx`);
  const pdfs = await loadPdfs(`${D}/notes_pdf_batch2`);
  const roster = await loadRoster(`${D}/harborline_member_roster.csv`);
  const priorAuths = JSON.parse(readFileSync('data/prior_auths.json', 'utf8'));
  const recs = buildRecords([...visits, ...pdfs], roster);
  const world: World = { members: new Map(roster.map((m) => [m.memberId, m])), priorAuths, visits: recs };
  const canon = (c: string[]) => [...toBillable(c)].sort().join(' ');

  let exact = 0;
  for (const ex of coded) {
    const rec = recs.find((r) => r.encId === ex.encId && !r.duplicateOf) ?? recs.find((r) => r.encId === ex.encId);
    if (!rec) { console.log(ex.encId, 'NOT FOUND'); continue; }
    const mine = claimCodes(rec.suggestions);
    const same = canon(mine) === canon(ex.codes);
    if (same) exact++;
    else {
      const a = new Set(toBillable(mine)), b = new Set(toBillable(ex.codes));
      console.log(`${ex.encId} coder[${ex.coder}]=${ex.codes.join(',')}  engine=${mine.join(',')}  onlyEngine=${[...a].filter((x) => !b.has(x))}  onlyCoder=${[...b].filter((x) => !a.has(x))}`);
    }
    const cf = flagsFor(rec, ex.codes, world).filter((f) => f.kind === 'denial').map((f) => f.ruleId);
    if (cf.length) console.log(`   ${ex.encId} coder claim would hit: ${cf.join(',')}`);
  }
  console.log(`\nmatch (V-150 treated as V-110+M-95): ${exact}/${coded.length}`);
  console.log(`visits=${recs.length} duplicates=${recs.filter((r) => r.duplicateOf).length} needsEscalation=${recs.filter((r) => r.needsEscalation && !r.duplicateOf).length} unresolvedMembers=${recs.filter((r) => !r.memberId).length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
