# 0xda-market Web App

Embeddable web interface for the 0xda-market marketplace.

The repository owns reusable browser presentation and interaction logic. The first production host is Telegram Mini Apps; future standalone, messenger and native wrappers must reuse the same contracts rather than duplicate market logic.

## Current vertical slice: Telegram

```text
web-app browser UI
  -> Telegram host adapter
  -> telegram-bot signed BFF
  -> core WebApp engine and market API
```

Ownership boundaries:

- `web-app` owns browser UI, responsive layout, local catalog navigation and host adapters;
- `telegram-bot` owns Telegram SDK entry points, signed `initData` validation and Telegram-specific BFF routes;
- `core` owns products, users, roles, catalog snapshots, quotes, orders, pricing and settlement contracts;
- browser code never receives the Telegram bot token, `MARKET_API_TOKEN` or an internal market user UUID.

The catalog is bootstrapped once per Mini App session. Search, category filtering, pagination and viewport changes operate on the immutable in-memory snapshot. Portrait shows six products, landscape twelve and wide landscape eighteen.

## Architectural role

The Web App owns shared presentation and interaction logic:

- product catalog and product selection;
- client purchase journeys;
- broker offer creation and inventory management;
- role-aware routing and screen composition;
- form state, validation, localization and responsive behavior;
- host-independent navigation and action contracts.

The Web App does not own authentication, role assignment, persistent market records, pricing authority or settlement. Those responsibilities remain in host adapters and the provider-agnostic core.

## Runtime contract

The Telegram slice currently targets the public VPS route layout:

- signed BFF: `/bot/webapp`
- shared core browser engine: `/webapp-core/index.js`

A deployment may override both before `src/app.js` loads:

```html
<script>
  window.__ZERO_X_DA_MARKET__ = {
    apiBaseUrl: "/bot/webapp",
    webAppCoreUrl: "/webapp-core/index.js"
  };
</script>
```

The checkout flow requires a real Telegram Mini App session because every server request carries signed `Telegram.WebApp.initData`.

## Host contract

A host supplies verified session context, capabilities, locale, theme, viewport behavior, navigation primitives and authenticated API transport. Locale is presentation input, never authorization. Broker quote currency remains an explicit user choice.

## Development and validation

The browser workspace has no runtime npm dependencies. Node.js is used only for deterministic validation and artifact assembly.

```sh
npm ci
npm run check
npm test
npm run build
npm run verify:dist
```

Serve the generated artifact locally:

```sh
python3 -m http.server 8080 --directory dist
```

Build and smoke-test the production-like container:

```sh
docker build -t 0xda-market-web-app .
docker run --rm -p 8080:8080 0xda-market-web-app
curl --fail http://127.0.0.1:8080/healthz
```

GitHub Actions runs source checks, tests, artifact verification, container build and HTTP smoke tests for every pull request. The workflow uploads `dist/` as a short-lived artifact for inspection.

## Deployment boundary

The container exposes port `8080` and provides:

- `GET /healthz` — static runtime health probe;
- `GET /` — Web App shell;
- SPA fallback to `index.html` for browser-owned routes.

This repository does not register Telegram menu buttons, mutate bot settings or deploy itself to production. Those actions require a separate reviewed infrastructure change after the development runtime is verified.

## Rollout

1. deploy this repository as the browser asset owner;
2. route the Telegram menu button to its `index.html`;
3. preserve `/bot/webapp/*` as the signed Telegram BFF;
4. verify development catalog, quote, acceptance and order refresh flows;
5. remove duplicated browser assets from `telegram-bot` only after verification;
6. add the standalone host adapter without weakening Telegram authentication.

## Repository boundaries

- [`0xda-market/core`](https://github.com/0xda-market/core) owns the provider-agnostic domain and API.
- [`0xda-market/telegram-bot`](https://github.com/0xda-market/telegram-bot) owns the Telegram transport and signed BFF.
- [`0xda-market/docs`](https://github.com/0xda-market/docs) owns cross-repository product and architecture documentation.
