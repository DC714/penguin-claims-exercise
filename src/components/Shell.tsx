import { AppShell, AppShellHeader, AppShellMain, Container, Group, Text } from "@mantine/core";
import { LinkAnchor } from "@/components/LinkAnchor";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell header={{ height: 60 }} padding="md" bg="#f9f7f2">
      <AppShellHeader>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="xs" align="baseline" wrap="nowrap">
              <LinkAnchor href="/" underline="never" c="deep.6" fw={700} fz={20} ff="var(--font-outfit), sans-serif">
                Northgate Coding Assist
              </LinkAnchor>
              <Text span size="xs" c="dimmed" visibleFrom="sm">pilot review build</Text>
            </Group>
            <Group gap="md" wrap="nowrap">
              <LinkAnchor href="/" c="deep.6" fw={500} size="sm">Queue</LinkAnchor>
              <LinkAnchor href="/compare" c="deep.6" fw={500} size="sm">Coder comparison</LinkAnchor>
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
