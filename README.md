# 0xda-market Web App

Host-agnostic marketplace UI and interaction package.

`web-app` owns catalog, checkout, broker, admin and shared presentation flows. It does not own authentication, messenger SDKs, signed session payloads or deployment entry points.

## Integration

A host repository imports `mountMarketApp` and supplies:

- `host`: locale, viewport, viewport events and feedback;
- `transport`: bootstrap, quote, acceptance and order refresh operations;
- `engine`: provider-agnostic catalog and checkout primitives from `core`.

```js
await mountMarketApp({ host, transport, engine, document });
```

Production adapters belong to their channel repositories:

- Telegram: `0xda-market/telegram-bot`;
- website/browser: the website repository;
- future messengers: their integration repositories.

This package contains no `Telegram.WebApp`, `initData`, Telegram endpoint, OAuth or browser-session implementation.

## Contracts

```text
Host
├── locale()
├── viewport()
├── onViewportChanged(callback)
└── selectionFeedback()

Transport
├── bootstrap({ locale })
├── quote({ sku, locale })
├── acceptQuote({ quoteId })
└── refreshOrder({ orderId })
```

## Repository boundaries

- `core` owns products, users, roles, quotes, orders, pricing and settlement contracts.
- `web-app` owns reusable presentation and interaction flows.
- each host repository owns its SDK, authentication, transport and deployment.

## Validation

```sh
npm run check
npm test
```
