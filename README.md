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
const { catalog, session, currencies } = app.context();
```

`transport.bootstrap()` returns the complete `{ data, meta }` JSON document. Resource operations return their `data` resource. Broker hosts pass the explicit context and transport to `mountBrokerWorkspace`; listings are durable core resources, not browser-local drafts. Users with role `admin` mount the same broker workspace.

Production adapters belong to their channel repositories:

- Telegram: [`0xda-market/telegram-bot`](https://github.com/0xda-market/telegram-bot);
- website/browser: the website host repository;
- future messengers: their integration repositories.

This package contains no `Telegram.WebApp`, `initData`, Telegram endpoint, OAuth or browser-session implementation.

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

- `listAdminProducts({ locale })`;
- `updateAdminProduct({ sku, version, attributes })`;
- `saveAdminProductLocalization({ sku, locale, fullName, buttonLabel, version? })`.

`createAdminCatalogController` keeps locale-neutral product versions independent from localization versions. `mountAdminProducts` exposes short name, status, position, marketability, metadata and localized copy. It never edits SKU or price state. Stale writes remain server-defined concurrency errors and are surfaced to the user without browser-side retries.

## Pre-wallet delivery sequence

The implementation order preserves existing core contracts:

1. role workspace navigation and admin overview;
2. products and localizations;
3. price proposals, application and history;
4. users, identity lookup and role administration;
5. customer and administrator order history;
6. administrator visibility over broker listings;
7. manual fulfillment task operations;
8. wallet and automated settlement as a separate architecture phase.

Each capability must introduce or reuse an explicit provider-neutral core API, a host transport operation and focused UI tests. Wallet-specific state must not leak into the preceding workspaces.

## Repository boundaries

- [`core`](https://github.com/0xda-market/core) owns products, users, roles, currencies, quotes, orders, pricing and settlement contracts.
- `webapp-core` owns browser-native state and reusable interaction flows.
- each host owns its SDK, authentication, transport, HTML/CSS shell and deployment.

Hosts must consume an immutable commit or released package version. Mutable default-branch module URLs are not a supported production contract.

## Development deployment

The `development` GitHub environment requires:

- secrets: `SSH_HOST`, `SSH_USER` and `SSH_PRIVATE_KEY`;
- variable: `SSH_DEPLOYMENT_PATH`.

`SSH_DEPLOYMENT_PATH` is the same shared base path used by `core`. WebApp releases remain isolated under `<SSH_DEPLOYMENT_PATH>/webapp-core/environments/development`. The SSH port is fixed to `22022` by the workflow.

## Validation

```sh
npm run check
npm test
```
