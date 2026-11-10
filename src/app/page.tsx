import { Suspense } from "react";
import Link from "next/link";
import { Anchor, Badge, Card, Group, Loader, Paper, SimpleGrid, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title, Center, ScrollArea } from "@mantine/core";
import { sql } from "@/lib/db";
import { day, visitHref } from "@/lib/format";

export default function Page({ searchParams }: { searchParams: Promise<{ risk?: string }> }) {
  return (
    <Stack gap="md" py="md">
      <Title order={1} c="deep.6">Review queue</Title>
      <Suspense fallback={<Center py="xl"><Loader color="brand" /></Center>}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </Stack>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{label}</Text>
      <Text ff="var(--font-outfit), sans-serif" fz={28} fw={700} c={color}>{value}</Text>
    </Paper>
  );
}

async function Queue({ searchParams }: { searchParams: Promise<{ risk?: string }> }) {
  const { risk } = await searchParams;
  const [rows, ruleRows] = await Promise.all([
    sql`
      select v.enc_id, v.dos, v.provider, v.member_id, v.needs_escalation,
        (select string_agg(code, ', ' order by id) from suggestions s where s.enc_id = v.enc_id and s.source = 'rules-v1') as codes,
        (select count(*) from denial_flags f where f.enc_id = v.enc_id and f.source = 'rules-v1' and f.kind = 'denial')::int as denials,
        (select count(*) from denial_flags f where f.enc_id = v.enc_id and f.source = 'rules-v1' and f.kind = 'warning')::int as warns
      from visits v where v.duplicate_of is null
      order by denials desc, warns desc, v.dos, v.enc_id`,
    sql`
      select f.rule_id, count(distinct f.enc_id)::int as n
      from denial_flags f join visits v using (enc_id)
      where v.duplicate_of is null and f.source = 'rules-v1' and f.kind = 'denial'
      group by 1 order by 1`,
  ]);
  const shown = risk ? rows.filter((r) => r.denials > 0) : rows;
  const withDenial = rows.filter((r) => r.denials > 0).length;
  const review = rows.filter((r) => r.needs_escalation).length;
  return (
    <>
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
        <Stat label="Visits" value={rows.length} />
        <Stat label="Likely denial" value={withDenial} color="red.7" />
        <Stat label="Needs review" value={review} color="yellow.8" />
      </SimpleGrid>
      <Group gap="xs">
        <Text size="sm" c="dimmed">Denial risks by rule:</Text>
        {ruleRows.map((r) => <Badge key={r.rule_id} color="red" variant="light">{r.rule_id}: {r.n}</Badge>)}
      </Group>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">{shown.length} visits, likely denials first. Duplicate notes are hidden.</Text>
        <Anchor component={Link} href={risk ? "/" : "/?risk=1"} size="sm">{risk ? "Show all" : "Only likely denials"}</Anchor>
      </Group>
      <Card p={0}>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" miw={720}>
            <TableThead>
              <TableTr><TableTh>Visit</TableTh><TableTh>Date</TableTh><TableTh>Provider</TableTh><TableTh>Suggested codes</TableTh><TableTh>Denial risks</TableTh><TableTh>Warnings</TableTh></TableTr>
            </TableThead>
            <TableTbody>
              {shown.map((r) => (
                <TableTr key={r.enc_id} className="row">
                  <TableTd><Anchor component={Link} href={visitHref(r.enc_id)} className="row-link" fw={600}>{r.enc_id}</Anchor></TableTd>
                  <TableTd>{day(r.dos)}</TableTd>
                  <TableTd>{r.provider}</TableTd>
                  <TableTd>{r.codes}</TableTd>
                  <TableTd>{r.denials ? <Badge color="red">{r.denials}</Badge> : null}</TableTd>
                  <TableTd>
                    <Group gap={6} wrap="nowrap">
                      {r.warns ? <Badge color="yellow" variant="light">{r.warns}</Badge> : null}
                      {r.needs_escalation ? <Badge color="deep" variant="light">review</Badge> : null}
                    </Group>
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </ScrollArea>
      </Card>
    </>
  );
}
