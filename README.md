# 0xda-market WebApp Core

Host-agnostic marketplace UI, catalog state and interaction package.

`webapp-core` owns reusable catalog, pagination, checkout, broker listing and shared presentation flows. It does not own authentication, messenger SDKs, signed session payloads, backend APIs or channel deployment entry points.

## Integration

A host imports `mountMarketApp` and supplies:

- `host`: locale, viewport, viewport events and feedback;
- `transport`: bootstrap, checkout and role-specific resource operations;
- `document`: the host browser document.

The catalog and checkout engine is bundled and exported by this repository. A host may still pass a compatible `engine` explicitly for testing or staged migration.

```js
const app = await mountMarketApp({ host, transport, document });
const { catalog, locale, session, currencies } = app.context();
```

`transport.bootstrap()` returns the complete `{ data, meta }` document. Resource operations return their `data` resource. Broker hosts pass the explicit context and transport to `mountBrokerWorkspace`; listings are durable core resources, not browser-local drafts. Users with role `admin` mount the same broker workspace.

Production adapters belong to their channel repositories:

- Telegram: [`0xda-market/telegram-bot`](https://github.com/0xda-market/telegram-bot);
- website/browser: the website host repository;
- future messengers: their integration repositories.

This package contains no `Telegram.WebApp`, `initData`, Telegram endpoint, OAuth or browser-session implementation.

## Marketplace checkout

The buyer selects a product and an explicit quantity. The shared checkout calls:

- `quote({ sku, quantity, locale })`;
- `acceptQuote({ quoteId })`;
- `refreshOrder({ orderId })`.

The backend quote is authoritative for product availability, final client price and inventory reservation. The shared UI preserves the requested quantity throughout quote, acceptance and refresh states, disables quantity changes after reservation, and renders the returned total and expiration. It does not select a broker or calculate supply economics.

Quote acceptance may return an order with `status: "payment_pending"`. The UI renders the authoritative payment amount, currency and expiration from `order.attributes.payment`, keeps the order refreshable and makes no payment-success claim of its own. There is intentionally no browser payment-confirmation transport operation: payment confirmation belongs to a trusted backend or operator adapter.

After trusted confirmation, a refresh may return `accepted`, `pending`, `succeeded` or `failed` according to the provider-neutral fulfillment lifecycle. Inventory remains reserved while payment is pending and becomes sold only when core reports confirmation.

A product may remain in the complete catalog while unavailable. Hosts should preserve the backend `price: null` response so the card remains visible but cannot start checkout when no eligible broker liquidity exists.

## Localization

The shared WebApp owns all reusable interface copy. It currently ships complete `en_US` and `uk_UA` presentation for:

- market loading, search, categories, pagination and quantity-aware checkout;
- payment-pending checkout state and authoritative payment terms;
- broker listings and inventory balances;
- role navigation;
- administration overview;
- product creation, editing and localization;
- revisioned price administration.

`host.locale()` is normalized before bootstrap. Ukrainian Telegram language codes such as `uk` and `uk-UA` resolve to `uk_UA`; unsupported locales fall back to `en_US`. Product names continue to come from core product localizations. Stable category identifiers such as `telegram_premium`, `telegram_stars` and `crypto_asset` remain unchanged in transport and storage while `createI18n(...).category(...)` renders human-readable labels.

A host must pass the resolved locale into role-specific workspace mounts. Channel-specific static shell text should be neutral or updated before bootstrap so users do not see an English loading flash.

## Role workspaces

Workspace visibility derives only from the verified session supplied by the host:

| Role | Sections |
| --- | --- |
| `client` | Market |
| `broker` | Market, Listings |
| `admin` | Market, Listings, Administration |

`mountWorkspaceNavigation` controls section visibility without interpreting channel authentication. `mountAdminWorkspace` composes isolated administrator capabilities rather than creating one privileged catch-all surface.

## Products and localizations

An administrator host may supply:

- `createAdminProduct({ sku, attributes, localization })`;
- `listAdminProducts({ locale })`;
- `updateAdminProduct({ sku, version, attributes })`;
- `saveAdminProductLocalization({ sku, locale, fullName, buttonLabel, version? })`.

`mountAdminCreateProduct` creates one product and its initial localization. The shared controller always submits `status: "inactive"`; activation remains a separate reviewed edit after pricing and broker supply are ready. SKU creation is one-way in this surface and cannot silently mutate an existing product.

`createAdminCatalogController` keeps locale-neutral product versions independent from localization versions. `mountAdminProducts` exposes short name, status, position, marketability, metadata and localized copy. It never edits SKU or price state. Stale writes remain server-defined concurrency errors and are surfaced to the user without browser-side retries.

## Broker listings and inventory

Broker listing transport remains:

- `listBrokerListings()`;
- `createBrokerListing({ sku, quantity, priceAmount, currency })`;
- `updateBrokerListing({ listingId, quantity, priceAmount, currency, version })`;
- `withdrawBrokerListing({ listingId, version })`.

The workspace treats `quantity` as total committed inventory and renders the backend-owned `available_quantity`, `reserved_quantity` and `sold_quantity` balances. It does not derive or mutate those balances locally. Existing hosts that have not yet adopted the extended response remain readable with `available = quantity` and zero reserved/sold balances.

## Price proposals, application and history

An administrator host may supply:

- `getAdminPriceProposal({ locale })`;
- `applyAdminPrices({ revision, prices })`;
- `listAdminPriceHistory({ limit })`.

`createAdminPricingController` preserves the proposal revision and submits it with one complete catalog-wide application. Every active product and currency requires a positive USDT amount before the user can confirm. `mountAdminPrices` uses a two-step review and confirmation flow, then reloads the authoritative proposal and append-only history. A concurrent application remains a server-defined `concurrency_conflict`; the browser does not retry or merge stale values.

## Payment-aware delivery sequence

The implemented marketplace path is now:

1. administrator creates and localizes an inactive product;
2. administrator reviews activation and applies client pricing;
3. broker publishes finite supply and sees available, reserved and sold balances;
4. client requests a quantity-aware quote backed by a backend reservation;
5. client accepts the quote and receives a `payment_pending` order while inventory stays reserved;
6. a trusted server or operator confirms payment outside browser authority;
7. core commits inventory and starts provider-neutral fulfillment;
8. the client refreshes the same order through pending, success or failure states.

A real payment rail remains a separate adapter. Wallet addresses, payment intents, blockchain or acquiring callbacks, refunds, disputes, settlement and broker payouts must not be inferred or implemented in browser state.

Remaining operational capabilities are delivered separately: user administration, order history, admin-wide listing visibility, manual fulfillment operations, financial ledger, refunds/disputes, then automated settlement.

Each capability must introduce or reuse an explicit provider-neutral core API, a host transport operation and focused UI tests. Provider-specific financial state must not leak into reusable workspaces.

## Repository boundaries

- [`core`](https://github.com/0xda-market/core) owns products, users, roles, currencies, listings, reservations, quotes, orders, pricing, payment state and settlement contracts.
- `webapp-core` owns browser-native state and reusable interaction flows.
- each host owns its SDK, authentication, transport, HTML/CSS shell and deployment.

Hosts must consume an immutable commit or released package version. Mutable default-branch module URLs are not a supported production contract.

## Deployment

The repository has one `Deploy` workflow.

- automatic deployment runs only when a pull request into `master` is actually merged;
- synchronizing or updating an open pull request does not create a deployment run;
- closing a pull request without merging skips the deploy job;
- manual dispatch requires an explicit source branch, tag, or commit and an environment;
- only the `development` runtime is currently supported by `deploy/deploy.sh`.

The `development` GitHub environment requires:

- secrets: `SSH_HOST`, `SSH_USER` and `SSH_PRIVATE_KEY`;
- variable: `SSH_DEPLOYMENT_PATH`.

`SSH_DEPLOYMENT_PATH` is the same shared base path used by `core`. WebApp releases remain isolated under `<SSH_DEPLOYMENT_PATH>/webapp-core/environments/development`. The SSH port is fixed to `22022` by the workflow.

A successful health-gated deployment publishes the `deploy/vps-webapp-development` commit status on the exact release SHA. A failed deployment publishes the same context as `failure`.

## Validation

```sh
npm run check
npm test
```
