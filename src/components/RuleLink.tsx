import type { ReactNode } from "react";
import { LinkAnchor } from "@/components/LinkAnchor";
import { ruleHref } from "@/lib/ruleLinks";

/** Wraps a code or rule badge in a link to where it is documented (manual or Harborline bulletin); WARN-* and others stay plain. */
export function RuleLink({ refId, children }: { refId: string; children: ReactNode }) {
  const href = ruleHref(refId);
  if (!href) return <>{children}</>;
  const where = href.startsWith("/bulletin") ? "the Harborline bulletin" : "the coding manual";
  return <LinkAnchor href={href} underline="never" className="rule-link" aria-label={`${refId.split("/")[0]} in ${where}`} style={{ display: "inline-flex" }}>{children}</LinkAnchor>;
}
