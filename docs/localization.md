# Localization contract

`webapp-core` treats language and currency as independent presentation inputs. A locale can influence copy and the server-selected client currency, but it never locks a broker or client to that currency.

## Support tiers

### Full

These locales must contain the complete reusable UI bundle and category labels:

- `en_US` — canonical base and universal fallback, including English-speaking markets such as India and Nigeria;
- `uk_UA` — primary Ukrainian audience;
- `ru_RU` — Russian-language interface, including Russian-speaking users in Kazakhstan and Central Asia;
- `es_ES` — Spanish interface; regional variants such as `es_MX` normalize here;
- `pt_BR` — Brazilian Portuguese.

Language-family normalization is intentional for the current product: `ru-*` resolves to `ru_RU`, `es-*` to `es_ES`, and `pt-*` to `pt_BR`. This is a UI-copy decision, not a geographic or currency decision.

### European skeleton

The following locales are recognized and keep their locale identity, but their UI copy currently falls back to `en_US`:

| Locale | Currency context | Copy fallback |
| --- | --- | --- |
| `de_DE` | EUR | `en_US` |
| `fr_FR` | EUR | `en_US` |
| `it_IT` | EUR | `en_US` |
| `de_CH` | CHF | `en_US` |
| `fr_CH` | CHF | `en_US` |
| `it_CH` | CHF | `en_US` |
| `pl_PL` | PLN | `en_US` |
| `cs_CZ` | CZK | `en_US` |
| `hu_HU` | HUF | `en_US` |

`GBP` needs no separate skeleton because the base English bundle already covers it. The currency set mirrors the localized pricing currencies supported by core; adding a new currency does not automatically add a language.

## Fallback rules

1. Normalize the host language tag into one canonical application locale.
2. Use the matching full bundle when available.
3. Preserve a recognized skeleton locale so the server and host can make region-aware presentation decisions.
4. Fall back copy and category labels to `en_US`.
5. Unknown locales resolve entirely to `en_US`.

The browser never translates product data heuristically. Product names and button labels continue to come from core product localizations; this module owns reusable interface copy only.
