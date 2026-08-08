# Recipient picker host contract

Recipient selection is a shared checkout concern with a channel-specific picker boundary.

`webapp-core` keeps the marketplace recipient contract unchanged:

- `self` identifies the authenticated buyer;
- `username` identifies another Telegram recipient by the normalized username sent to the quote API.

For products whose purchase policy exposes a recipient, the shared checkout renders one `Recipient` control. `For me` needs no secondary field. `Someone else` may use an optional host method, `host.pickRecipient()`, to obtain a selected recipient. When the host provides that method, the shared UI renders a single picker action and then a compact selected-recipient row. Manual `@username` entry remains an explicit fallback. Hosts without a picker receive the manual field directly.

The host picker result is presentation data shaped as:

- `username`: required for the current marketplace contract;
- `name`: optional display name;
- host-specific identifiers may be returned but are not forwarded to core by this version.

The shared layer does not import a messenger SDK, enumerate contacts, resolve Telegram identities, or persist picker state. Telegram-specific selection belongs to `telegram-bot`.

Recipient and quantity controls are inserted inside the existing checkout card before the primary quote action. Hosts style the emitted `.checkout-recipient-*` markup while `webapp-core` owns its structure and state transitions.
