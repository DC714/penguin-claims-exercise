import { Mark, Paper, Text } from "@mantine/core";
import type { ReactNode } from "react";

export function Highlighted({ text, evidence }: { text: string; evidence: string[] }) {
  const spans: Array<[number, number]> = [];
  for (const e of evidence) {
    if (!e) continue;
    const i = text.indexOf(e);
    if (i >= 0) spans.push([i, i + e.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let pos = 0;
  for (const [s, e] of spans) {
    if (s < pos) continue;
    parts.push(text.slice(pos, s), <Mark key={s} color="#ffd9ec">{text.slice(s, e)}</Mark>);
    pos = e;
  }
  parts.push(text.slice(pos));
  return (
    <Paper withBorder p="md" radius="md">
      <Text component="pre" size="sm" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{parts}</Text>
    </Paper>
  );
}
