'use client';
import { useState } from "react";
import { Badge, Blockquote, Card, Group, Stack, Text, TextInput } from "@mantine/core";
import { searchBulletin } from "@/lib/bulletin";

/** Harborline rules with an in-page text search (no round trip). */
export function BulletinView() {
  const [q, setQ] = useState("");
  const rules = searchBulletin(q);
  return (
    <Stack gap="md">
      <TextInput type="search" label="Search the bulletin" placeholder="e.g. Bronze, V-150, 365" value={q} onChange={(e) => setQ(e.currentTarget.value)}
        description={q ? `${rules.length} rules match` : "Filters the rules as you type"} />
      {rules.length === 0 && <Text size="sm" c="dimmed">No rules match.</Text>}
      {rules.map((r) => (
        <Card key={r.id} id={r.id} p="md" className="manual-anchor">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Badge color="red" variant="filled" style={{ flexShrink: 0 }}>{r.id}</Badge>
            <Text size="sm">{r.text}</Text>
          </Group>
          <Blockquote color="gray" p="xs" mt="sm" iconSize={0} styles={{ root: { borderInlineStartWidth: 3 } }}>
            <Text size="xs" c="dimmed"><b>How this tool uses this rule:</b> {r.inTool}</Text>
          </Blockquote>
        </Card>
      ))}
    </Stack>
  );
}
