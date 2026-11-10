import { Suspense } from "react";
import { LinkAnchor } from "@/components/LinkAnchor";
import { StatTile } from "@/components/StatTile";
import { QueueFilterBar } from "@/components/QueueFilterBar";
import { RuleLink } from "@/components/RuleLink";
import { Badge, Card, Group, Loader, SimpleGrid, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title, Center, ScrollArea } from "@mantine/core";
import { sql } from "@/lib/db";
import { visitHref } from "@/lib/format";
import { parseQueueParams, queueHref, type QueueFilters } from "@/lib/queueFilters";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return (
    <Stack gap="md" py="md">
      <Title order={1} c="deep.6">Review queue</Title>
      <Suspense fallback={<Center py="xl"><Loader color="brand" /></Center>}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </Stack>
  );
}

interface Row { enc_id: string; dos: string | null; provider: string | null; needs_escalation: boolean; codes: string | null; denial_rules: string[]; warn_rules: string[] }

async function Queue({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [totals] = await sql`
    select count(*)::int as visits,
      count(*) filter (where exists (select 1 from denial_flags f where f.enc_id = v.enc_id and f.source = 'rules-v1' and f.kind = 'denial'))::int as denial,
      count(*) filter (where v.needs_escalation)::int as review
    from visits v where v.duplicate_of is null`;
  const [ruleRows, providerRows] = await Promise.all([
    sql`
      select f.rule_id, count(distinct f.enc_id)::int as n
      from denial_flags f join visits v using (enc_id)
      where v.duplicate_of is null and f.source = 'rules-v1' and f.kind = 'denial'
      group by 1 order by 1`,
    sql`select distinct provider from visits where duplicate_of is null and provider is not null order by 1`,
  ]);
  const providers = providerRows.map((p) => String(p.provider));
  const f = parseQueueParams(sp, providers);
  const rows = (await sql`
    select v.enc_id, v.dos::text as dos, v.provider, v.needs_escalation,
      (select string_agg(code, ', ' order by id) from suggestions s where s.enc_id = v.enc_id and s.source = 'rules-v1') as codes,
      array(select distinct rule_id from denial_flags f where f.enc_id = v.enc_id and f.source = 'rules-v1' and f.kind = 'denial' order by 1) as denial_rules,
      array(select distinct rule_id from denial_flags f where f.enc_id = v.enc_id and f.source = 'rules-v1' and f.kind = 'warning' order by 1) as warn_rules
    from visits v
    where v.duplicate_of is null
      and (${f.from ?? null}::date is null or v.dos >= ${f.from ?? null}::date)
      and (${f.to ?? null}::date is null or v.dos <= ${f.to ?? null}::date)
      and (cardinality(${f.providers}::text[]) = 0 or v.provider = any(${f.providers}::text[]))
      and (${f.filter ?? null}::text is distinct from 'review' or v.needs_escalation)
      and (${f.filter ?? null}::text is distinct from 'denial'
           or exists (select 1 from denial_flags d where d.enc_id = v.enc_id and d.source = 'rules-v1' and d.kind = 'denial'))
      and (${f.rule ?? null}::text is null
           or exists (select 1 from denial_flags d where d.enc_id = v.enc_id and d.source = 'rules-v1' and d.rule_id = ${f.rule ?? null}::text))
    order by cardinality(array(select 1 from denial_flags d where d.enc_id = v.enc_id and d.source = 'rules-v1' and d.kind = 'denial')) desc,
      v.needs_escalation desc, v.dos, v.enc_id`) as Row[];

  // Tiles and rule badges replace each other; dates and providers stay.
  const keep = { from: f.from, to: f.to, providers: f.providers };
  const tile = (next: Partial<QueueFilters>) => queueHref({ ...keep, ...next });
  const filtered = Boolean(f.filter || f.rule || f.from || f.providers.length);
  const chips: Array<{ label: string; href: string }> = [];
  if (f.filter) chips.push({ label: f.filter === "denial" ? "Likely denial" : "Needs review", href: tile({}) });
  if (f.rule) chips.push({ label: `Rule ${f.rule}`, href: tile({}) });
  if (f.from) chips.push({ label: f.from === f.to ? f.from : `${f.from} to ${f.to}`, href: queueHref({ ...f, from: undefined, to: undefined }) });
  for (const p of f.providers) chips.push({ label: p, href: queueHref({ ...f, providers: f.providers.filter((x) => x !== p) }) });
  const what = f.filter === "denial" ? " with likely denials" : f.filter === "review" ? " needing review" : f.rule ? ` hitting ${f.rule}` : "";

  return (
    <>
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        <StatTile href={tile({})} label="Visits" value={totals.visits} active={!f.filter && !f.rule} ariaLabel={`Show all visits, ${totals.visits}`} />
        <StatTile href={tile({ filter: "denial" })} label="Likely denial" value={totals.denial} color="red.7" active={f.filter === "denial"} ariaLabel={`Show visits with likely denial, ${totals.denial}`} />
        <StatTile href={tile({ filter: "review" })} label="Needs review" value={totals.review} color="yellow.8" active={f.filter === "review"} ariaLabel={`Show visits that need review, ${totals.review}`} />
      </SimpleGrid>
      <Group gap="xs">
        <Text size="sm" c="dimmed">Denial risks by rule:</Text>
        {ruleRows.map((r) => {
          const on = f.rule === r.rule_id;
          return (
            <Group key={r.rule_id} gap={2} wrap="nowrap">
            <LinkAnchor href={tile({ rule: String(r.rule_id) })} underline="never" aria-current={on ? "true" : undefined} aria-label={`Show visits hitting ${r.rule_id}, ${r.n}`}>
              <Badge color="red" variant={on ? "filled" : "light"} style={{ cursor: "pointer" }}>{r.rule_id}: {r.n}</Badge>
            </LinkAnchor>
            <RuleLink refId={String(r.rule_id)}><Text span size="xs" c="dimmed" td="underline" title={`${r.rule_id} in the Harborline bulletin`}>rule</Text></RuleLink>
            </Group>
          );
        })}
      </Group>
      <QueueFilterBar key={queueHref(f)} current={f} providers={providers} />
      {chips.length > 0 && (
        <Group gap="xs" aria-label="Active filters">
          {chips.map((c) => (
            <LinkAnchor key={c.label} href={c.href} underline="never" aria-label={`Remove filter: ${c.label}`}>
              <Badge color="deep" variant="light" rightSection={<span aria-hidden>&times;</span>} style={{ cursor: "pointer", textTransform: "none" }}>{c.label}</Badge>
            </LinkAnchor>
          ))}
          <LinkAnchor href="/" size="sm">Clear all filters</LinkAnchor>
        </Group>
      )}
      <Text size="sm" c="dimmed" aria-live="polite">
        <b>{filtered ? `${rows.length} of ${totals.visits}` : rows.length}</b> visits{what}. Likely denials first; duplicate notes are hidden.
      </Text>
      <Card p={0}>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" miw={760}>
            <TableThead>
              <TableTr><TableTh>Visit</TableTh><TableTh>Date</TableTh><TableTh>Provider</TableTh><TableTh>Suggested codes</TableTh><TableTh>Denial risks</TableTh><TableTh>Warnings</TableTh></TableTr>
            </TableThead>
            <TableTbody>
              {rows.map((r) => (
                <TableTr key={r.enc_id} className="row">
                  <TableTd><LinkAnchor href={visitHref(r.enc_id)} className="row-link" fw={600}>{r.enc_id}</LinkAnchor></TableTd>
                  <TableTd style={{ whiteSpace: "nowrap" }}>{r.dos}</TableTd>
                  <TableTd>{r.provider}</TableTd>
                  <TableTd>{r.codes}</TableTd>
                  <TableTd><Group gap={4}>{r.denial_rules.map((x) => <RuleLink key={x} refId={x}><Badge color="red" style={{ cursor: "pointer" }}>{x}</Badge></RuleLink>)}</Group></TableTd>
                  <TableTd>
                    <Group gap={4}>
                      {r.warn_rules.map((x) => <Badge key={x} color="yellow" variant="light">{x.replace("WARN-", "")}</Badge>)}
                      {r.needs_escalation ? <Badge color="deep" variant="light">review</Badge> : null}
                    </Group>
                  </TableTd>
                </TableTr>
              ))}
              {rows.length === 0 && <TableTr><TableTd colSpan={6}><Text size="sm" c="dimmed">No visits match these filters.</Text></TableTd></TableTr>}
            </TableTbody>
          </Table>
        </ScrollArea>
      </Card>
    </>
  );
}
