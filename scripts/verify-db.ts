import { sql } from '../src/lib/db';

async function main() {
  const one = async (q: string) => (await sql.query(q))[0];
  console.log(await one(`select (select count(*) from visits) visits, (select count(*) from visits where duplicate_of is null) non_dup, (select count(*) from coder_examples) coder_examples, (select count(*) from members) members, (select count(*) from prior_auths) prior_auths, (select count(*) from not_coded) not_coded`));
  console.log('suggestions by source', await sql.query(`select source, count(*) from suggestions group by 1 order by 1`));
  console.log('flags', await sql.query(`select source, rule_id, kind, count(*) from denial_flags group by 1,2,3 order by 1,2`));
  const rows = await sql.query(`select s.enc_id, s.code, s.evidence, v.note from suggestions s join visits v using (enc_id) union all select n.enc_id, n.code, n.evidence, v.note from not_coded n join visits v using (enc_id) where n.evidence is not null and n.evidence <> ''`);
  // Every suggestion needs evidence (G11): empty evidence would pass the substring test, so it is its own violation.
  const empty = rows.filter((r) => !String(r.evidence ?? '').trim());
  const bad = rows.filter((r) => String(r.evidence ?? '').trim() && !String(r.note).includes(String(r.evidence)));
  console.log(`evidence substring check: ${rows.length - bad.length - empty.length}/${rows.length} ok, ${bad.length + empty.length} violations (${empty.length} empty)`);
  for (const b of [...empty, ...bad].slice(0, 10)) console.log('  VIOLATION', b.enc_id, b.code, JSON.stringify(b.evidence));
  const [v] = await sql.query(`select enc_id, note from visits v where duplicate_of is null and exists (select 1 from suggestions s where s.enc_id = v.enc_id) and exists (select 1 from denial_flags d where d.enc_id = v.enc_id) order by enc_id limit 1`);
  console.log('\nspot-check', v.enc_id, '\n', v.note);
  console.log(await sql.query(`select source, code, evidence, rule, confidence, note from suggestions where enc_id = $1`, [v.enc_id]));
  console.log(await sql.query(`select source, rule_id, kind, why from denial_flags where enc_id = $1`, [v.enc_id]));
  if (bad.length + empty.length) { console.error(`FAIL: ${bad.length + empty.length} evidence violations`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
