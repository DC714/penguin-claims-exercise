'use client';
import { useState } from "react";
import { Badge, Card, Group, ScrollArea, SegmentedControl, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, TextInput, Title } from "@mantine/core";
import { searchManual, type CodeKind } from "@/lib/manual";

const KIND_LABEL: Record<CodeKind, string> = { visit: "V visit", procedure: "P procedure", finding: "D finding", modifier: "M modifier" };
const KIND_COLOR: Record<CodeKind, string> = { visit: "deep", procedure: "brand", finding: "gray", modifier: "yellow" };

/** Code table and rules with an in-page text search and a kind filter (no round trip). */
export function ManualView() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | CodeKind>("all");
  const found = searchManual(q);
  const codes = found.codes.filter((c) => kind === "all" || c.kind === kind);
  return (
    <Stack gap="lg">
      <TextInput type="search" label="Search the manual" placeholder="e.g. telehealth, splint, M-25, G6" value={q} onChange={(e) => setQ(e.currentTarget.value)}
        description={q ? `${codes.length} codes and ${found.rules.length} rules match` : "Filters the code table and the rules as you type"} />
      <Stack gap="xs">
        <Title order={2} id="code-table">1. Code table</Title>
        <SegmentedControl aria-label="Filter codes by kind" value={kind} onChange={(v) => setKind(v as "all" | CodeKind)} fullWidth={false} style={{ alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}
          data={[{ value: "all", label: "All" }, ...(Object.keys(KIND_LABEL) as CodeKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))]} />
        <Card p={0}>
          <ScrollArea type="auto">
            <Table verticalSpacing="xs" miw={640} className="manual-table">
              <TableThead><TableTr><TableTh>Code</TableTh><TableTh>Kind</TableTh><TableTh>Meaning</TableTh><TableTh>When it applies</TableTh></TableTr></TableThead>
              <TableTbody>
                {codes.map((c) => (
                  <TableTr key={c.code} id={c.code} className="manual-anchor">
                    <TableTd fw={700} style={{ whiteSpace: "nowrap" }}>{c.code}</TableTd>
                    <TableTd><Badge size="sm" variant="light" color={KIND_COLOR[c.kind]}>{c.kind}</Badge></TableTd>
                    <TableTd>{c.meaning}</TableTd>
                    <TableTd>{c.when}</TableTd>
                  </TableTr>
                ))}
                {codes.length === 0 && <TableTr><TableTd colSpan={4}><Text size="sm" c="dimmed">No codes match.</Text></TableTd></TableTr>}
              </TableTbody>
            </Table>
          </ScrollArea>
        </Card>
      </Stack>
      <Stack gap="xs">
        <Title order={2} id="coding-rules">2. Coding rules</Title>
        {found.rules.length === 0 && <Text size="sm" c="dimmed">No rules match.</Text>}
        <Stack component="ol" gap="xs" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {found.rules.map((r) => (
            <Card component="li" key={r.id} id={r.id} p="sm" className="manual-anchor">
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <Badge color="deep" variant="filled" style={{ flexShrink: 0 }}>{r.id}</Badge>
                <Text size="sm">{r.text}</Text>
              </Group>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
