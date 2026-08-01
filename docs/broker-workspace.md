# Broker workspace

The broker workspace is a host-independent, role-driven surface in the shared Web App.

It is mounted only when the verified session snapshot reports role `broker` or `admin`. Telegram-specific SDK state remains in `0xda-market/telegram-bot`; a browser or future messenger host can mount the same workspace from its own verified session.

## Development slice

The current slice supports:

- product selection from the shared catalog snapshot;
- quantity editing;
- quoted amount editing;
- explicit quote currency selection;
- creation, editing and deletion of offer drafts.

Locale may influence presentation, but it does not lock quote currency. The broker can change currency independently.

Drafts are stored locally under `0xda-market.broker-offers.v1`. They are provisional UI state, not durable market offers. Persistence, authorization, normalization and publication belong to an explicit `core` offer API in the next slice.

The archived `telegram-broker-bot` repository is not an active host and must not be referenced by new implementations.
