'use client';
import Link from "next/link";
import { Paper, Text } from "@mantine/core";

/** A summary number that is also a link to the matching filtered view. */
export function StatTile({ href, label, value, color, active, ariaLabel }: { href: string; label: string; value: number; color?: string; active: boolean; ariaLabel: string }) {
  return (
    <Paper
      component={Link} href={href} aria-label={ariaLabel} aria-current={active ? "true" : undefined}
      withBorder radius="lg" p="md" className="stat-tile"
      style={{ display: "block", textDecoration: "none", borderColor: active ? "var(--mantine-color-brand-6)" : undefined, borderWidth: active ? 2 : undefined, background: active ? "var(--mantine-color-brand-0)" : undefined }}
    >
      <Text component="div" className="eyebrow">{label}</Text>
      <Text ff="var(--font-outfit), sans-serif" fz={28} fw={700} c={color ?? "black"}>{value}</Text>
    </Paper>
  );
}
