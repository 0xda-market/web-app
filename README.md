# 0xda-market Web App

Embeddable web-interface core for the 0xda-market marketplace.

This repository is **not a standalone website** and does not own a public channel. It provides the reusable marketplace interface that a host application embeds and adapts for its environment.

Initial hosts include the Telegram bot and a regular browser shell. Future messenger or native wrappers can integrate the same interface without duplicating the client and broker journeys.

## Architectural role

The Web App owns shared presentation and interaction logic:

- product catalog and product selection;
- client purchase journeys;
- broker offer creation and inventory management;
- role-aware routing and screen composition;
- form state, validation, localization, and responsive behavior;
- host-independent navigation and action contracts.

The Web App does not own:

- user authentication or role assignment;
- Telegram Bot API or any messenger SDK;
- channel commands, keyboards, or notifications;
- persistent product, offer, order, or payment records;
- exchange-rate authority, pricing policy, or settlement.

Those responsibilities belong to the host adapter and the provider-agnostic core.

## Host contract

A host embeds the Web App and supplies a verified session context containing:

- internal user identity;
- granted capabilities such as `can_buy`, `can_manage_offers`, and `can_administer`;
- locale and suggested display currency;
- theme and viewport information;
- navigation, close, back, and external-action capabilities;
- API transport and authentication.

The Web App never treats locale as authorization. It also never infers a broker's trading currency from locale. Locale may suggest an initial currency, but a broker explicitly selects the currency in which the offer is quoted.

## Broker offer model

The first vertical slice is the broker flow without database persistence.

A broker selects a real product from the shared catalog and enters:

- quantity;
- quoted amount;
- quoted currency, initially suggested from locale but always editable;
- optional validity period and local status.

The local prototype stores the original broker quote as `amount + currency` and may calculate a provisional normalized USDT value for comparison. USDT is the marketplace accounting unit for broker-side comparison; client-facing currency is a separate presentation concern.

Local state is intentionally replaceable. Moving to persistent offers must preserve the same interface contracts while replacing local storage with core-backed APIs.

## Repository boundaries

- [`0xda-market/core`](https://github.com/0xda-market/core) owns products, users, roles, offers, inventory, orders, pricing inputs, fulfillment, and settlement contracts.
- [`0xda-market/telegram-bot`](https://github.com/0xda-market/telegram-bot) owns the Telegram host adapter, verified Telegram session, role-aware entry points, commands, and notifications.
- [`0xda-market/docs`](https://github.com/0xda-market/docs) owns cross-repository product and architecture documentation.

The Web App remains reusable across hosts; each host adapter remains replaceable.