import type { Metadata } from "next";
import { Alert, Stack, Text, Title } from "@mantine/core";
import { BulletinView } from "@/components/BulletinView";
import { BULLETIN } from "@/lib/bulletin";

export const metadata: Metadata = { title: "Harborline rules 2026-07 | Northgate Coding Assist" };

export default function Page() {
  return (
    <Stack gap="md" py="md" maw={960}>
      <Alert color="deep" variant="light">
        Source: Harborline Health Plan Provider Bulletin 2026-07 (provided by the clinic). These rules produce warnings in this tool; coding follows the Northgate manual.
      </Alert>
      <Stack gap={2}>
        <div className="eyebrow">Reference</div>
      <Title order={1}>{BULLETIN.title}</Title>
        <Text fw={600} ff="var(--font-outfit), sans-serif" fz="lg">{BULLETIN.subtitle}</Text>
        <Text size="xs" c="dimmed">{BULLETIN.meta}</Text>
      </Stack>
      <Text>{BULLETIN.intro}</Text>
      <BulletinView />
      <Text size="xs" c="dimmed">{BULLETIN.closing}</Text>
    </Stack>
  );
}
