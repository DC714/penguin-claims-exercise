'use client';
import Link from "next/link";
import { Anchor, type AnchorProps } from "@mantine/core";
import type { ReactNode } from "react";

// Mantine Anchor rendered as a Next Link. Must be a client component: a Link
// function cannot be passed as a prop from a server component.
export function LinkAnchor({ href, children, className, ...rest }: AnchorProps & { href: string; className?: string; children: ReactNode }) {
  return <Anchor component={Link} href={href} className={className} {...rest}>{children}</Anchor>;
}
