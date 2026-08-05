# Fluid workspace markup contract

`webapp-core` owns reusable section structure and semantic markup. Host adapters own visual material, layout and motion.

Each section below states the structure a host may rely on. Class names, `data-*` state and element order are the contract; tone, spacing, geometry and motion are not.

## Workspace navigation

Every `.workspace-tab` exposes:

- `role="tab"` and authoritative `aria-selected` state;
- a localized `aria-label` that remains available when visible copy is hidden;
- one decorative `.workspace-tab-icon[data-workspace-icon]` with `aria-hidden="true"`;
- one `.workspace-tab-label` containing the full localized label.

Adapters may switch to icon-only presentation when a localized label cannot fit without wrapping or truncation. They must not remove the accessible name, reorder tabs or infer authorization from presentation state.

## Administration overview

The administration overview is an orientation rail, not the primary working surface.

`.admin-capability-rail` is a semantic list of compact summaries. Each `.admin-capability-summary[data-admin-capability]` exposes a name, metric and concise note, and carries `data-admin-capability-state`:

- `available` — the capability is mounted in this session and the card ends with one `.admin-capability-link[data-admin-capability-link]` anchored at the working section (`#admin-prices`, `#admin-products`);
- `planned` — no writable section exists yet, so no link is emitted.

Rail order follows operational frequency rather than catalog order: prices, products, users, orders, listings, fulfillment. Writable sections remain mounted immediately after the rail in the same operational order:

1. prices;
2. products;
3. product creation;
4. localizations.

## Prices

`.admin-price-row[data-sku]` composes one price in the order the operator reads it:

1. `.admin-price-name`;
2. `.admin-price-amounts`, holding `.admin-price-amount[data-price-amount="current"]` and `[data-price-amount="previous"]`, each with a `.admin-price-amount-label` and `.admin-price-amount-value` (`—` when the server reports none);
3. `.admin-price-input` — the edited value, a native decimal input;
4. `.admin-price-change` — the localized changed or unchanged copy.

`data-price-state` is `changed` or `unchanged` on both the row and its indicator, and is rewritten while the operator types, so an adapter may accent a single changed row without re-reading the section.

The save action stays singular: `.admin-price-form[data-changed-prices]` reports how many rows differ from the server, `.admin-price-apply` is disabled at zero and otherwise names the count. Only changed values are submitted, against the loaded revision exposed as `data-price-revision` on the section. The section — not the button — carries the pending state.

## Products

The selected product is the working context. `#admin-products` mounts in flow order, each part marked with `data-product-step`:

1. `selector` — `.admin-product-selector` wrapping the compact product `select`;
2. `summary` — `.admin-product-summary[data-product-sku][data-product-status]`, a `.admin-product-summary-name` plus `.admin-product-summary-fields` entries `.admin-product-summary-field[data-product-field]` for `sku`, `status`, `position`, `marketable` and `localizations`;
3. `fields` — `.admin-product-form`, the locale-neutral catalog state;
4. the product save action inside that form;
5. `localizations` — `#admin-localizations`, a separate section.

Product state and localized copy carry independent versions, so they are marked `data-product-scope="locale-neutral"` and `data-product-scope="localized"` and must not be merged into one form. Each `.admin-localization-chip[data-locale]` reports the loaded locale through `aria-pressed`.

## Listings

`.broker-listing[data-listing][data-listing-status]` communicates supply state as one operational card:

1. `.broker-listing-header` — `.broker-listing-product` and the localized `.broker-listing-status`;
2. `.broker-listing-price` — `.broker-listing-price-label` and `.broker-listing-price-amount`;
3. `.broker-listing-inventory[data-inventory-owner="server"]` — a description list of `.broker-listing-balance[data-balance]` entries for `total`, `available`, `reserved` and `sold`, each with a label and value;
4. `.broker-listing-actions` — `.broker-listing-action[data-listing-action]` for `edit` and `withdraw`.

The four balances are one server-owned equation and are grouped for that reason. The browser never sums, derives or corrects them; the group carries the same figures as an `aria-label` so the equation is announced once. `data-listing-action="withdraw"` identifies the destructive action.

## Orders and fulfillment

Order state is presented as a lifecycle. Every `.broker-order[data-order][data-order-status][data-payment-status]` contains a `.broker-order-header`, one rail and one actions container.

`.order-lifecycle-rail[data-order-lifecycle]` is an ordered list that always emits all five `.order-lifecycle-step[data-lifecycle-step]` entries — `requested`, `accepted`, `payment`, `fulfillment`, `completion` — so the rail never collapses. Each step carries `data-lifecycle-state`:

- `complete` — the server reports the step reached;
- `current` — the next step the server is waiting on, also marked `aria-current="step"`;
- `upcoming` — not reached;
- `failed` — the step that failed, and the terminal step, which then reads as failed copy.

`orderLifecycle(order)` derives those states and is exported for hosts and tests. It reads reported state only; it never advances an order.

`.broker-order-actions` holds an action only where the server contract permits the next transition — accept while requested, complete once accepted and payment is confirmed. A transition the operator cannot take yet is expressed by the rail, not by a disabled button.

## Scope

None of this markup alters transport operations, role authorization, write ownership, pending-state behavior or server authority.
