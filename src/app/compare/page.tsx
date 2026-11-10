import { Suspense } from "react";
import { LinkAnchor } from "@/components/LinkAnchor";
import { Badge, Card, Center, Group, Loader, ScrollArea, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from "@mantine/core";
import { sql } from "@/lib/db";
import { visitHref } from "@/lib/format";

const billable = (codes: string[]) => codes.flatMap((c) => (c === "V-150" ? ["V-110", "M-95"] : [c]));
const split = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export default function Page() {
  return (
    <Stack gap="md" py="md">
      <Title order={1} c="deep.6">Engine vs coder examples</Title>
      <Suspense fallback={<Center py="xl"><Loader color="brand" /></Center>}>
        <Compare />
      </Suspense>
    </Stack>
  );
}

function Codes({ list, color }: { list: string[]; color?: string }) {
  return <Group gap={4}>{list.map((c) => <Badge key={c} color={color ?? "gray"} variant={color ? "light" : "outline"}>{c}</Badge>)}</Group>;
}

async function Compare() {
  const rows = (await sql`
    select e.enc_id, e.codes, e.coder,
      (select string_agg(code, ', ' order by id) from suggestions s where s.enc_id = e.enc_id and s.source = 'rules-v1') as mine,
      (select string_agg(distinct rule_id, ', ') from denial_flags f where f.enc_id = e.enc_id and f.source = 'coder:' || e.coder) as coder_flags
    from coder_examples e order by e.enc_id`) as Array<{ enc_id: string; codes: string; coder: string; mine: string | null; coder_flags: string | null }>;
  const parsed = rows.map((r) => {
    const a = new Set(billable(split(r.mine))), b = new Set(billable(split(r.codes)));
    return { ...r, onlyEngine: [...a].filter((x) => !b.has(x)), onlyCoder: [...b].filter((x) => !a.has(x)) };
  });
  const same = parsed.filter((p) => !p.onlyEngine.length && !p.onlyCoder.length).length;
  return (
    <>
      <Text size="sm" c="dimmed">
        <b>{same}</b> of {parsed.length} match (V-150 and V-110 + M-95 treated as equal). Differences are for review; not all are engine errors, see the decision log.
      </Text>
      <Card p={0}>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" miw={900}>
            <TableThead>
              <TableTr>
                <TableTh>Visit</TableTh><TableTh>Coder</TableTh><TableTh>Coder codes</TableTh><TableTh>Engine (rules-v1)</TableTh>
                <TableTh>Only engine</TableTh><TableTh>Only coder</TableTh><TableTh>Coder claim would hit</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {parsed.map((p) => {
                const diff = p.onlyEngine.length > 0 || p.onlyCoder.length > 0;
                return (
                  <TableTr key={p.enc_id} className="row" bg={diff ? "var(--mantine-color-yellow-0)" : undefined}>
                    <TableTd><LinkAnchor href={visitHref(p.enc_id)} className="row-link" fw={600}>{p.enc_id}</LinkAnchor></TableTd>
                    <TableTd>{p.coder}</TableTd>
                    <TableTd><Codes list={split(p.codes)} /></TableTd>
                    <TableTd><Codes list={split(p.mine)} /></TableTd>
                    <TableTd><Codes list={p.onlyEngine} color="deep" /></TableTd>
                    <TableTd><Codes list={p.onlyCoder} color="yellow" /></TableTd>
                    <TableTd><Codes list={split(p.coder_flags)} color="red" /></TableTd>
                  </TableTr>
                );
              })}
            </TableTbody>
          </Table>
        </ScrollArea>
      </Card>
    </>
  );
}
