import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Anchor, Badge, Button, Card, Center, Group, Loader, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { sql } from "@/lib/db";
import { day } from "@/lib/format";
import { Highlighted } from "@/components/Highlighted";
import { review } from "@/app/actions";

export default function Page({ params }: { params: Promise<{ enc: string }> }) {
  return (
    <Stack gap="md" py="md">
      <Anchor component={Link} href="/" size="sm">&larr; Queue</Anchor>
      <Suspense fallback={<Center py="xl"><Loader color="brand" /></Center>}>
        <Visit params={params} />
      </Suspense>
    </Stack>
  );
}

function safeDecode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
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
  return (
    <>
      <Stack gap={4}>
        <Group gap="sm" align="baseline">
          <Title order={1} c="deep.6">{enc}</Title>
          {v.needs_escalation && <Badge color="deep" variant="light">needs review</Badge>}
        </Group>
        <Text c="dimmed" size="sm">
          {day(v.dos)} &middot; {v.provider ?? "provider unknown"} &middot; member {v.member_id ?? "unresolved"} (resolved by {v.resolve_method})
        </Text>
      </Stack>
      {v.duplicate_of && (
        <Alert color="yellow" title="Duplicate note">
          Same note as <Anchor component={Link} href={`/visits/${encodeURIComponent(v.duplicate_of)}`}>{v.duplicate_of}</Anchor>.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Stack gap="sm">
          <Title order={3}>Note <Text span size="sm" c="dimmed" fw={400}>(evidence highlighted)</Text></Title>
          <Highlighted text={v.note} evidence={sug.map((s) => s.evidence as string)} />
          {coder && (
            <Card>
              <Text size="sm">Coder <b>{coder.coder}</b> coded: <b>{coder.codes}</b></Text>
            </Card>
          )}
        </Stack>
        <Stack gap="lg">
          {sources.length === 0 && <Text size="sm" c="dimmed">No codes suggested.</Text>}
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
                      <Text fw={700} fz="lg" ff="var(--font-outfit), sans-serif">{s.code}</Text>
                      <Group gap={6}>
                        {s.rule && <Badge variant="outline" color="gray">{s.rule}</Badge>}
                        {s.confidence && <Badge color={confColor[String(s.confidence).toLowerCase()] ?? "gray"}>{s.confidence}</Badge>}
                      </Group>
                    </Group>
                    {hr02 && <Text size="sm" fw={600} c="deep.6" mt={4}>Billable form: V-110 + M-95</Text>}
                    <Text fs="italic" size="sm" mt={4}>&ldquo;{s.evidence}&rdquo;</Text>
                    {s.note && <Text size="sm" c="dimmed" mt={4}>{s.note}</Text>}
                    <form action={review}>
                      <input type="hidden" name="enc" value={enc} />
                      <input type="hidden" name="source" value={src} />
                      <input type="hidden" name="code" value={s.code} />
                      <Group gap="xs" mt="sm" align="flex-end">
                        <TextInput name="reviewer" placeholder="Your name" aria-label="Reviewer name" size="xs" w={140} defaultValue={latest?.reviewer === "anonymous" ? "" : latest?.reviewer} />
                        <Button type="submit" name="decision" value="accept" size="xs" color="green" variant={latest?.decision === "accept" ? "filled" : "light"}>Accept</Button>
                        <Button type="submit" name="decision" value="reject" size="xs" color="red" variant={latest?.decision === "reject" ? "filled" : "light"}>Reject</Button>
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

          <Stack gap="xs">
            <Title order={3}>Denial risks and warnings</Title>
            {flags.length === 0 && <Text size="sm" c="dimmed">None.</Text>}
            {flags.map((f) => {
              const isCoder = String(f.source).startsWith("coder:");
              const denial = f.kind === "denial";
              return (
                <Alert key={f.id} color={denial ? "red" : "yellow"} variant="light" title={
                  <Group gap={6}>
                    <span>{f.rule_id}</span>
                    <Badge size="xs" color={denial ? "red" : "yellow"}>{denial ? "denial" : "warning"}</Badge>
                    {isCoder && <Badge size="xs" color="deep" variant="light">coder claim ({String(f.source).slice(6)})</Badge>}
                  </Group>
                }>
                  <Text size="sm">{f.why}</Text>
                  <Text size="sm" mt={4}><b>Fix:</b> {f.fix}</Text>
                </Alert>
              );
            })}
          </Stack>

          {nc.length > 0 && (
            <Stack gap="xs">
              <Title order={3}>Not coded on purpose (G3)</Title>
              {nc.map((n) => (
                <Card key={n.id} p="sm">
                  <Text size="sm"><b>{n.code}</b>{n.evidence ? <> <i>&ldquo;{n.evidence}&rdquo;</i></> : null}</Text>
                  <Text size="sm" c="dimmed">{n.reason}</Text>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </SimpleGrid>
    </>
  );
}
