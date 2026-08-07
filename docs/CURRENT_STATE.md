# Current project state

This document summarizes the reusable browser contract implemented by `webapp-core` as of 2026-08-07.

## Ownership

`webapp-core` owns host-agnostic browser state, section structure, reusable interaction flows, localization bundles, and accessible markup contracts. It does not own authentication, Telegram SDK integration, signed session verification, backend APIs, FX calculation, profitability, broker ranking, payment confirmation, or deployment entry points.

The browser must render authoritative values returned by core. It never recomputes client prices, exchange rates, marketplace margin, broker eligibility, inventory balances, or order allocation.

## Buyer flow

The shared marketplace UI supports:

- complete catalog bootstrap and in-memory pagination/search/category navigation;
- quantity-aware quote creation;
- explicit quote acceptance;
- `payment_pending` order presentation;
- authoritative order refresh through provider-neutral fulfillment states;
- listed-but-unavailable products without inventing executable pricing.

A product may be visible because broker inventory exists while checkout remains disabled because core reports that the product is not safely executable.

## Broker and admin workspaces

Role-gated reusable surfaces include:

- broker listings with total, available, reserved, and sold quantities;
- allocated broker-order lifecycle presentation;
- administrator price review and atomic changed-price application;
- product creation and editing;
- product localization editing;
- administration capability navigation.

Every asynchronous write makes its complete owning section inert, exposes a pending state, and cannot be duplicated until the transport settles.

## Localization

Language and currency are independent presentation inputs.

Full reusable UI bundles currently exist for:

- `en_US`;
- `uk_UA`;
- `ru_RU`;
- `es_ES`;
- `pt_BR`.

Recognized European skeleton locales preserve their regional identity while UI copy falls back to `en_US`: `de_DE`, `fr_FR`, `it_IT`, `de_CH`, `fr_CH`, `it_CH`, `pl_PL`, `cs_CZ`, and `hu_HU`.

Language-family normalization currently maps `ru-*` to `ru_RU`, `es-*` to `es_ES`, and `pt-*` to `pt_BR`. Product names and button labels remain server-owned product localizations; the browser bundle owns reusable interface copy only.

## Host contract

Production hosts consume an immutable reviewed `webapp-core` revision. The Telegram host is `0xda-market/telegram-bot`; future hosts must provide the same host and transport boundaries without introducing channel-specific behavior into this package.

Markup ownership is documented in `docs/fluid-markup-contract.md`, and localization tiers are documented in `docs/localization.md`.
