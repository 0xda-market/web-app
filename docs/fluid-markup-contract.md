# Fluid workspace markup contract

`webapp-core` owns reusable section structure and semantic markup. Host adapters own visual material, layout and motion.

## Workspace navigation

Every `.workspace-tab` exposes:

- `role="tab"` and authoritative `aria-selected` state;
- a localized `aria-label` that remains available when visible copy is hidden;
- one decorative `.workspace-tab-icon[data-workspace-icon]` with `aria-hidden="true"`;
- one `.workspace-tab-label` containing the full localized label.

Adapters may switch to icon-only presentation when a localized label cannot fit without wrapping or truncation. They must not remove the accessible name, reorder tabs or infer authorization from presentation state.

## Administration overview

The administration overview is an orientation rail, not the primary working surface.

`.admin-capability-rail` is a semantic list of compact summaries. Each `.admin-capability-summary[data-admin-capability]` exposes a name, metric and concise note. Writable sections remain mounted immediately after the rail in operational order:

1. prices;
2. products;
3. product creation;
4. localizations.

The markup change does not alter transport operations, role authorization, write ownership, pending-state behavior or server authority.
