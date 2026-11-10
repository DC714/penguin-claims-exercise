import type { Metadata } from "next";
import { Alert, List, ListItem, Stack, Text, Title } from "@mantine/core";
import { ManualView } from "@/components/ManualView";
import { MANUAL } from "@/lib/manual";

export const metadata: Metadata = { title: "Coding manual v3.2 | Northgate Coding Assist" };

export default function Page() {
  return (
    <Stack gap="md" py="md" maw={960}>
      <Alert color="deep" variant="light">
        Source: Northgate Family Clinic coding manual v3.2 (provided by the clinic). The tool follows this manual for what to code; Harborline&apos;s rules only produce warnings.
      </Alert>
      <Stack gap={2}>
        <Title order={1} c="deep.6">{MANUAL.title}</Title>
        <Text fw={600} ff="var(--font-outfit), sans-serif" fz="lg">{MANUAL.subtitle}</Text>
        <Text size="sm" c="dimmed">{MANUAL.maintained}</Text>
      </Stack>
      <Text>{MANUAL.intro}</Text>
      <List spacing={4} size="sm">{MANUAL.kinds.map((k) => <ListItem key={k}>{k}</ListItem>)}</List>
      <ManualView />
    </Stack>
  );
}
