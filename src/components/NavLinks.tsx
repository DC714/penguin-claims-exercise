'use client';
import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Anchor, Group, Text } from "@mantine/core";

const LINKS: Array<{ href: string; label: string; short?: string; match: (p: string) => boolean }> = [
  { href: "/", label: "Queue", match: (p: string) => p === "/" || p.startsWith("/visits") },
  { href: "/compare", label: "Coder comparison", short: "Compare", match: (p: string) => p.startsWith("/compare") },
  { href: "/manual", label: "Coding manual", short: "Manual", match: (p: string) => p.startsWith("/manual") },
  { href: "/bulletin", label: "Harborline rules", short: "Harborline", match: (p: string) => p.startsWith("/bulletin") },
];

/** Reads the path, so under Cache Components it must render inside <Suspense> (see NavBar). */
function ActiveNavLinks() {
  return <NavLinksView path={usePathname() ?? ""} />;
}

/** Main navigation; the active page is highlighted once the path is known (plain links while it streams in). */
export function NavBar() {
  return <Suspense fallback={<NavLinksView path="" />}><ActiveNavLinks /></Suspense>;
}

function NavLinksView({ path }: { path: string }) {
  return (
    <Group gap="sm" wrap="nowrap" component="nav" aria-label="Main">
      {LINKS.map((l) => {
        const on = l.match(path);
        return (
          <Anchor key={l.href} component={Link} href={l.href} size="sm" fw={on ? 700 : 500} c={on ? "brand.6" : "deep.6"}
            aria-current={on ? "page" : undefined} style={{ whiteSpace: "nowrap", borderBottom: on ? "2px solid var(--mantine-color-brand-6)" : "2px solid transparent", paddingBottom: 2 }}>
            {l.short ? <><Text span inherit visibleFrom="md">{l.label}</Text><Text span inherit hiddenFrom="md">{l.short}</Text></> : l.label}
          </Anchor>
        );
      })}
    </Group>
  );
}
