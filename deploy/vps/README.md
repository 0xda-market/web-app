# Web App VPS deployment

The development Web App is an independently health-gated static service.

## Runtime

- root: `/opt/0xda-market-web-app/environments/development`
- immutable releases: `releases/<git-sha>`
- active symlink: `current`
- bind address: `127.0.0.1:10002`
- container: `zero-x-da-market-web-app-development`
- private Docker network: `zero-x-da-market-edge`
- internal health: `http://127.0.0.1:10002/healthz`
- public route: `https://0xda-market.nilx.one/app/`

The deploy script builds and starts the candidate release before moving the active symlink. A failed health gate stops the candidate and attempts to restore the previous release.

## Caddy contract

The infrastructure Caddyfile must route the application prefix and strip `/app` before proxying:

```caddyfile
handle_path /app/* {
  reverse_proxy 127.0.0.1:10002
}
```

This makes `/app/healthz` reach the container's `/healthz` endpoint. The existing `/bot/webapp/*` route remains the signed Telegram BFF and `/webapp-core/*` remains the provider-agnostic browser engine.

## GitHub environment

Create or reuse the `development` environment with these secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_PORT` — canonical value `22022`
- `VPS_SSH_KEY`

A push to `main` runs the complete reusable CI workflow and deploys only after it passes. `workflow_dispatch` provides an explicit recovery or replay entry point.

## Rollout order

1. merge the foundation PR;
2. merge the development deployment PR;
3. add the Caddy route and reload Caddy;
4. verify `/app/healthz` and `/app/`;
5. set the development Telegram Mini App URL to `https://0xda-market.nilx.one/app/`;
6. exercise catalog, quote, acceptance and order refresh in Telegram;
7. remove `telegram-bot/webapp` only in a later cleanup after the new route is proven.

Production deployment and production Telegram registration are intentionally out of scope.
