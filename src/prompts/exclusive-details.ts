import type { MouseEvent } from "react";

// Native summary clicks include Enter/Space; fields stay mounted when closed.
export function exclusiveDetails(event: MouseEvent<HTMLDetailsElement>) {
  const details = event.currentTarget;
  if (!(event.target instanceof Element) || event.target.closest("summary")?.parentElement !== details || details.open) return;
  for (const sibling of details.parentElement?.children ?? []) {
    if (sibling instanceof HTMLDetailsElement && sibling !== details) sibling.open = false;
  }
}
