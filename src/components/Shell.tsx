import { AppShell, AppShellHeader, AppShellMain, Anchor, Container, Group, Text } from "@mantine/core";
import Link from "next/link";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell header={{ height: 60 }} padding="md" bg="#f9f7f2">
      <AppShellHeader>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="xs" align="baseline" wrap="nowrap">
              <Anchor component={Link} href="/" underline="never" c="deep.6" fw={700} fz={20} ff="var(--font-outfit), sans-serif">
                Northgate Coding Assist
              </Anchor>
              <Text span size="xs" c="dimmed" visibleFrom="sm">pilot review build</Text>
            </Group>
            <Group gap="md" wrap="nowrap">
              <Anchor component={Link} href="/" c="deep.6" fw={500} size="sm">Queue</Anchor>
              <Anchor component={Link} href="/compare" c="deep.6" fw={500} size="sm">Coder comparison</Anchor>
            </Group>
          </Group>
        </Container>
      </AppShellHeader>
      <AppShellMain>
        <Container size="xl">{children}</Container>
      </AppShellMain>
    </AppShell>
  );
}
