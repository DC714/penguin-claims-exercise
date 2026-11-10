'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, MultiSelect, SimpleGrid, TextInput } from "@mantine/core";
import { queueHref, type QueueFilters } from "@/lib/queueFilters";

/**
 * Date range and provider filters. Values stay ISO date strings (YYYY-MM-DD) end to end, so no timezone
 * conversion can shift a day. Applying pushes a URL, so views can be shared and Back works.
 */
export function QueueFilterBar({ current, providers }: { current: QueueFilters; providers: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(current.providers);
  // Dates are read from the form on submit (uncontrolled inputs), so any way the browser fills them in counts.
  const apply = (form: HTMLFormElement) => {
    const d = new FormData(form);
    const from = String(d.get("from") ?? "") || undefined, to = String(d.get("to") ?? "") || undefined;
    router.push(queueHref({ ...current, from, to: to ?? from, providers: picked }));
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); apply(e.currentTarget); }} aria-label="Filter visits">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm" verticalSpacing="xs">
        <TextInput type="date" name="from" label="From" description="Alone: that single day" defaultValue={current.from ?? ""} />
        <TextInput type="date" name="to" label="To" description="Optional, for a range" defaultValue={current.to ?? ""} />
        <MultiSelect label="Providers" description="One or more" placeholder={picked.length ? undefined : "All providers"} data={providers}
          value={picked} onChange={setPicked} searchable clearable comboboxProps={{ withinPortal: true }} />
        <Group align="flex-end" gap="xs">
          <Button type="submit">Apply</Button>
        </Group>
      </SimpleGrid>
    </form>
  );
}
