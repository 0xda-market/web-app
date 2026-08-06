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
- private execution eligibility, routing tier and estimated order share;
- the administrator sale price and maximum executable ask in the listing currency.

Locale may influence presentation, but it does not lock quote currency. The broker can change currency independently.

Listings are persisted through the host transport and the provider-neutral `core`
API. Core validates the broker/admin role, internal-user ownership, marketable
asset, canonical currency, exact decimal precision and optimistic-concurrency
version. The browser never receives the internal user ID or database access.

Core is the sole authority for routing feedback. The browser formats the reported share but never derives profitability, compares broker asks or predicts rank. Exact competitor asks and identities are not part of the response. Lowering an ask can move a listing from `unlikely` to `competitive` or `best`, which increases its estimated allocation share without changing the client sale price. A `superseded` listing receives no extra share because the same broker already has a lower executable ask for that product.

An administrator uses the same broker workspace and contract; there is no
separate administrator listing surface.

The archived `telegram-broker-bot` repository is not an active host and must not be referenced by new implementations.
