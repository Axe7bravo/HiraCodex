# Single-origin external testing

Hira can be exposed through one HTTPS tunnel pointed at the Next.js web server
on port 3000. Do not expose the NestJS API or PostgreSQL separately.

## Web configuration

In `apps/web/.env.local`:

```text
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=http://localhost:4000
EXTERNAL_DEV_ORIGIN=https://YOUR-TUNNEL.example
```

`NEXT_PUBLIC_API_URL=/api` is browser-relative. If the active tunnel origin is
`https://YOUR-TUNNEL.example`, browser requests resolve to
`https://YOUR-TUNNEL.example/api/*`. Next.js rewrites those requests to
`http://localhost:4000/*`, removing the `/api` prefix before NestJS receives
the request.

`EXTERNAL_DEV_ORIGIN` permits that exact tunnel hostname to request development
assets such as `/_next/*`. Next.js expects hostname entries in
`allowedDevOrigins`; the configuration validates the HTTP(S) origin and derives
the hostname. The setting is ignored outside development.

The same base is used for public property-photo URLs and authenticated private
document requests. Property photos remain optimized by Next/Image. Private
verification documents remain protected by their existing authenticated API
routes and are not made public by the rewrite.

## API configuration

In `apps/api/.env`:

```text
WEB_ORIGIN=https://YOUR-TUNNEL.example
```

Use the exact active HTTPS origin with no path. This preserves the existing
credentialed CORS policy rather than allowing arbitrary origins.

The session cookie remains host-only, HttpOnly, SameSite=Lax and scoped to `/`.
When login is proxied through the HTTPS web origin, the browser associates the
cookie with that external origin and sends it on subsequent same-origin `/api`
requests. Production continues to add the Secure attribute through the existing
`NODE_ENV=production` behavior.

Restart Next.js after changing environment variables or `next.config.ts`.
Normal localhost development needs no override: its existing default browser
API base remains `http://localhost:4000`.
