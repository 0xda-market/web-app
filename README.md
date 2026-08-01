# 0xda-market WebApp Core

Host-agnostic marketplace UI, catalog state and interaction package.

`webapp-core` owns reusable catalog, pagination, checkout, broker, admin and shared presentation flows. It does not own authentication, messenger SDKs, signed session payloads, backend APIs or channel deployment entry points.

## Integration

A host imports `mountMarketApp` and supplies:

- `host`: locale, viewport, viewport events and feedback;
- `transport`: bootstrap, quote, acceptance and order refresh operations;
- `document`: the host browser document.

The catalog and checkout engine is bundled and exported by this repository. A host may still pass a compatible `engine` explicitly for testing or staged migration.

```js
const app = await mountMarketApp({ host, transport, document });
const { catalog, session, currencies } = app.context();
```

`transport.bootstrap()` returns the complete `{ data, meta }` JSON document. Resource operations return their `data` resource. Broker hosts pass the explicit context to `mountBrokerWorkspace`; local drafts are isolated by the verified opaque session subject and deployment environment.

Production adapters belong to their channel repositories:

- Telegram: [`0xda-market/telegram-bot`](https://github.com/0xda-market/telegram-bot);
- website/browser: the website host repository;
- future messengers: their integration repositories.

This package contains no `Telegram.WebApp`, `initData`, Telegram endpoint, OAuth or browser-session implementation.

## Repository boundaries

- [`core`](https://github.com/0xda-market/core) owns products, users, roles, currencies, quotes, orders, pricing and settlement contracts.
- `webapp-core` owns browser-native state and reusable interaction flows.
- each host owns its SDK, authentication, transport, HTML/CSS shell and deployment.

Hosts must consume an immutable commit or released package version. Mutable default-branch module URLs are not a supported production contract.

## Validation

```sh
npm run check
npm test
```
