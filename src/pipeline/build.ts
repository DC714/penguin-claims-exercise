import { readFileSync } from 'node:fs';
import { loadPdfs, loadRoster, loadXlsx, type CoderExample } from '../ingest/load';
import { buildRecords, type World } from './world';
import type { PriorAuth } from '../engine/types';

/**
 * The one place the world (visits, roster, prior auths) is built from the source files. Ingest, escalate and
 * compare all use it, so the records, their database ids and the "other visits" used by HR-03/HR-07 cannot
 * diverge between scripts.
 */
export async function loadWorld(dataDir = process.env.DATA_DIR ?? '../customer_materials'): Promise<{ world: World; coded: CoderExample[] }> {
  const { visits, coded } = await loadXlsx(`${dataDir}/visits_export_2026-10-20.xlsx`);
  const roster = await loadRoster(`${dataDir}/harborline_member_roster.csv`);
  const priorAuths = JSON.parse(readFileSync('data/prior_auths.json', 'utf8')) as PriorAuth[];
  const recs = buildRecords([...visits, ...(await loadPdfs(`${dataDir}/notes_pdf_batch2`))], roster);
  return { world: { members: new Map(roster.map((m) => [m.memberId, m])), priorAuths, visits: recs }, coded };
}
