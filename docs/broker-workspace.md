# Broker workspace

The broker workspace is a host-independent, role-driven surface in the shared Web App.

It is mounted only when the verified session snapshot reports role `broker` or `admin`. Telegram-specific SDK state remains in `0xda-market/telegram-bot`; a browser or future messenger host can mount the same workspace from its own verified session.

## Durable listing slice

The current slice supports:

- product selection from the shared catalog snapshot;
- quantity editing;
- unit-price editing;
- explicit quote currency selection;
- publication, editing and withdrawal of broker-owned listings.

Locale may influence presentation, but it does not lock quote currency. The broker can change currency independently.

Listings are persisted through the host transport and the provider-neutral `core`
API. Core validates the broker/admin role, internal-user ownership, marketable
asset, canonical currency, exact decimal precision and optimistic-concurrency
version. The browser never receives the internal user ID or database access.

An administrator uses the same broker workspace and contract; there is no
separate administrator listing surface.

The archived `telegram-broker-bot` repository is not an active host and must not be referenced by new implementations.
