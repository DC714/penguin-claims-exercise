import { Suspense } from "react";
import { LinkAnchor } from "@/components/LinkAnchor";
import { notFound } from "next/navigation";
import { Alert, Badge, Box, Button, Card, Center, Group, Loader, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { sql } from "@/lib/db";
import { day } from "@/lib/format";
import { Highlighted } from "@/components/Highlighted";
import { review } from "@/app/actions";
import { RuleLink } from "@/components/RuleLink";
import { ruleHref } from "@/lib/ruleLinks";

export default function Page({ params }: { params: Promise<{ enc: string }> }) {
  return (
    <Stack gap="md" py="md">
      <LinkAnchor href="/" size="sm">&larr; Queue</LinkAnchor>
      <Suspense fallback={<Center py="xl"><Loader color="brand" /></Center>}>
        <Visit params={params} />
      </Suspense>
    </Stack>
  );
}

function safeDecode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

interface FlagRow { id: number; source: string; rule_id: string; kind: string; why: string; fix: string }
interface FlagGroup { ruleId: string; denial: boolean; items: Array<{ why: string; fix: string; sources: string[] }> }

const sourceLabel = (src: string) => (src.startsWith("coder:") ? `coder claim (${src.slice(6)})` : src);

/** One card per rule id; flags from different sources that say the same thing collapse into one line with several source badges. */
function groupFlags(flags: FlagRow[]): FlagGroup[] {
  const groups: FlagGroup[] = [];
  for (const f of flags) {
    let g = groups.find((x) => x.ruleId === f.rule_id);
    if (!g) groups.push((g = { ruleId: f.rule_id, denial: false, items: [] }));
    g.denial ||= f.kind === "denial";
    const same = g.items.find((i) => i.why === f.why);
    if (same) { if (!same.sources.includes(f.source)) same.sources.push(f.source); }
    else g.items.push({ why: f.why, fix: f.fix, sources: [f.source] });
  }
  return groups.sort((a, b) => Number(b.denial) - Number(a.denial) || a.ruleId.localeCompare(b.ruleId));
}

function Risks({ groups }: { groups: FlagGroup[] }) {
  return (
    <Stack gap="xs">
      <Title order={3}>Denial risks and warnings</Title>
      {groups.length === 0 && <Text size="xs" c="dimmed">None.</Text>}
      {groups.map((g) => (
        <Alert key={g.ruleId} color={g.denial ? "red" : "yellow"} variant="light" title={
          <Group gap={6}>
            <RuleLink refId={g.ruleId}><span>{g.ruleId}</span></RuleLink>
            <Badge size="xs" color={g.denial ? "red" : "yellow"}>{g.denial ? "denial" : "warning"}</Badge>
          </Group>
        }>
          <Stack gap="sm">
            {g.items.map((i) => (
              <div key={i.why}>
                <Group gap={4} mb={4}>{i.sources.map((src) => <Badge key={src} size="xs" color="deep" variant="light">{sourceLabel(src)}</Badge>)}</Group>
                <Text size="sm">{i.why}</Text>
                <Text size="sm" mt={4}><b>Fix:</b> {i.fix}</Text>
              </div>
            ))}
          </Stack>
        </Alert>
      ))}
    </Stack>
  );
}

const confColor: Record<string, string> = { high: "green", medium: "yellow", low: "red" };

async function Visit({ params }: { params: Promise<{ enc: string }> }) {
  const enc = safeDecode((await params).enc);
  const [v] = await sql`select * from visits where enc_id = ${enc}`;
  if (!v) notFound();
  const [sug, flags, nc, coderRows, revs] = await Promise.all([
    sql`select * from suggestions where enc_id = ${enc} order by source, id`,
    sql`select * from denial_flags where enc_id = ${enc} order by kind, source, rule_id`,
    sql`select * from not_coded where enc_id = ${enc} order by id`,
    sql`select * from coder_examples where enc_id = ${enc}`,
    sql`select * from reviews where enc_id = ${enc} order by at desc`,
  ]);
  const coder = coderRows[0];
  const sources = [...new Set(sug.map((s) => s.source as string))];
  const groups = groupFlags(flags as FlagRow[]);
  return (
    <>
      <Stack gap={4}>
        <div className="eyebrow">Visit</div>
        <Group gap="sm" align="baseline">
          <Title order={1}>{enc}</Title>
          {v.needs_escalation && <Badge color="deep" variant="light">needs review</Badge>}
        </Group>
        <Text c="dimmed" size="xs">
          {day(v.dos)} &middot; {v.provider ?? "provider unknown"} &middot; member {v.member_id ?? "unresolved"} (resolved by {v.resolve_method})
        </Text>
      </Stack>
      {v.duplicate_of && (
        <Alert color="yellow" title="Duplicate note">
          Same note as <LinkAnchor href={`/visits/${encodeURIComponent(v.duplicate_of)}`}>{v.duplicate_of}</LinkAnchor>.
        </Alert>
      )}
      <Box hiddenFrom="md"><Risks groups={groups} /></Box>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Stack gap="sm">
          <Title order={3}>Note <Text span size="xs" c="dimmed" fw={400}>(evidence highlighted)</Text></Title>
          <Highlighted text={v.note} evidence={sug.map((s) => s.evidence as string)} />
          {coder && (
            <Card>
              <Text size="sm">Coder <b>{coder.coder}</b> coded: <b>{coder.codes}</b></Text>
            </Card>
          )}
        </Stack>
        <Stack gap="lg">
          <Box visibleFrom="md"><Risks groups={groups} /></Box>
          {sources.length === 0 && <Text size="xs" c="dimmed">No codes suggested.</Text>}
          {sources.map((src) => (
            <Stack key={src} gap="xs">
              <Group gap="xs">
                <Title order={3}>Suggested codes</Title>
                <Badge color="deep" variant="light">{src}</Badge>
              </Group>
              {sug.filter((s) => s.source === src).map((s) => {
                const mine = revs.filter((r) => r.source === src && r.code === s.code);
                const latest = mine[0];
                const hr02 = s.code === "V-150" && flags.some((f) => f.source === src && f.rule_id === "HR-02");
                return (
                  <Card key={s.id} p="md">
                    <Group justify="space-between" wrap="nowrap">
                      <RuleLink refId={s.code}><Text fw={700} fz="lg" ff="var(--font-outfit), sans-serif">{s.code}</Text></RuleLink>
                      <Group gap={6}>
                        {s.rule && <RuleLink refId={s.rule}><Badge variant="outline" color="gray" style={ruleHref(s.rule) ? { cursor: "pointer" } : undefined}>{s.rule}</Badge></RuleLink>}
                        {s.confidence && <Badge color={confColor[String(s.confidence).toLowerCase()] ?? "gray"}>{s.confidence}</Badge>}
                      </Group>
                    </Group>
                    {hr02 && <Text size="sm" fw={600} c="deep.6" mt={4}>Billable form: V-110 + M-95</Text>}
                    <Text fs="italic" size="sm" mt={4}>&ldquo;{s.evidence}&rdquo;</Text>
                    {s.note && <Text size="xs" c="dimmed" mt={4}>{s.note}</Text>}
                    <form action={review}>
                      <input type="hidden" name="enc" value={enc} />
                      <input type="hidden" name="source" value={src} />
                      <input type="hidden" name="code" value={s.code} />
                      <Group gap="xs" mt="sm" align="flex-end">
                        <TextInput name="reviewer" placeholder="Your name" aria-label="Reviewer name" maxLength={60} size="xs" w={140} defaultValue={latest?.reviewer === "anonymous" ? "" : latest?.reviewer} />
                        <Button type="submit" name="decision" value="accept" aria-label={`Accept ${s.code}`} size="xs" color="green" variant={latest?.decision === "accept" ? "filled" : "light"}>Accept</Button>
                        <Button type="submit" name="decision" value="reject" aria-label={`Reject ${s.code}`} size="xs" color="red" variant={latest?.decision === "reject" ? "filled" : "light"}>Reject</Button>
                      </Group>
                    </form>
                    {latest && (
                      <Text size="xs" c="dimmed" mt={6}>
                        {mine.map((r) => `${r.decision === "accept" ? "Accepted" : "Rejected"} by ${r.reviewer}`).join("; ")}
                      </Text>
                    )}
                  </Card>
                );
              })}
            </Stack>
          ))}

          {nc.length > 0 && (
            <Stack gap="xs">
              <Title order={3}>Not coded on purpose (G3)</Title>
              {nc.map((n) => (
                <Card key={n.id} p="sm">
                  <Text size="sm"><RuleLink refId={n.code}><b>{n.code}</b></RuleLink>{n.evidence ? <> <i>&ldquo;{n.evidence}&rdquo;</i></> : null}</Text>
                  <Text size="xs" c="dimmed">{n.reason}</Text>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </SimpleGrid>
    </>
  );
}
