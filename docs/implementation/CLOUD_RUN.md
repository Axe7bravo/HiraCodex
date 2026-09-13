# Cloud Run API preparation

Target: Cloud Run in `europe-west3` (Frankfurt), Node.js 22, with Neon
PostgreSQL in AWS `eu-central-1` and Firebase App Hosting for the web app.
Nothing has been deployed by this repository preparation.

## Container

Build from the repository root, using Linux amd64 for Cloud Run:

```sh
docker build --platform linux/amd64 -f apps/api/Dockerfile -t hira-api .
```

The multi-stage image uses the root lockfile and pinned pnpm 10.28.0. Only the
API workspace is installed. Prisma Client is generated on Debian Linux, NestJS
is compiled, and pnpm deploy creates an isolated production dependency tree.
Client generation is repeated against that tree so the final runtime includes
the generated client and Linux engine, independently of pnpm symlinks in the
build workspace. OpenSSL and CA certificates are present in both stages.

The final image contains production dependencies, package metadata, and compiled
API output. It runs as the non-root `node` user with `node dist/main.js`.
Source, tests, seeds, local uploads, environment files, and build tools are not
copied into the runtime image. No database connection or credentials are needed
to generate the client or compile the application.

Cloud Run supplies `PORT`; NestJS listens on it at `0.0.0.0`. The local fallback
remains port 4000. `EXPOSE 8080` is descriptive and does not override `PORT`.
Cloud Run terminates HTTPS and forwards HTTP to the container.

## Runtime environment

Supply configuration through Cloud Run environment settings and secret
references, never Docker build arguments or committed environment files:

| Variables | Values / purpose |
| --- | --- |
| `NODE_ENV` | `production` (also the image default) |
| `PORT` | Supplied by Cloud Run; do not set manually |
| `DATABASE_URL` | Neon pooled PostgreSQL URL, preserving its TLS parameters |
| `WEB_ORIGIN` | Exact Firebase App Hosting HTTPS origin |
| `JWT_SECRET` | Long random session secret |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend credential and verified sender |
| `PROPERTY_STORAGE_DRIVER`, `VERIFICATION_STORAGE_DRIVER` | Both `s3` |
| `PROPERTY_S3_REGION`, `VERIFICATION_S3_REGION` | `auto` for R2; actual region for other providers |
| `PROPERTY_S3_BUCKET`, `VERIFICATION_S3_BUCKET` | Private buckets |
| `PROPERTY_S3_ENDPOINT`, `VERIFICATION_S3_ENDPOINT` | Provider endpoints; required for R2 |
| `PROPERTY_S3_ACCESS_KEY_ID`, `PROPERTY_S3_SECRET_ACCESS_KEY` | Property storage credentials |
| `VERIFICATION_S3_ACCESS_KEY_ID`, `VERIFICATION_S3_SECRET_ACCESS_KEY` | Private verification storage credentials |
| `POSTHOG_API_KEY`, `POSTHOG_HOST` | Optional pair; use the project ingestion host |

The schema continues using `DATABASE_URL`; no additional direct-URL variable or
Cloud SQL integration is introduced. Configure maximum instances and per-instance
database pool capacity within the Neon connection budget.

## Migrations and rollout

Use a controlled release environment with the same checkout, pnpm dependencies,
Prisma CLI, and authorized database credentials. Before sending traffic to the
new API revision, run:

```sh
pnpm --dir apps/api prisma:migrate:deploy
```

This command is a release step, not the container entrypoint. The runtime image
does not include migration tooling. For migration operations requiring a direct
connection, supply Neon's direct URL as `DATABASE_URL` in the release environment
only; retain the pooled URL for the running API. Review migrations and backup
readiness before rollout. Never run development migrations, reset, seed, or
Prisma Studio on production. See [production operations](PRODUCTION_DEPLOYMENT.md)
for backup and rollback policy.

## Routing, health, and operations

Configure an HTTP startup probe at `/health` on the container port (normally
8080). The existing endpoint returns 200 when Prisma can reach PostgreSQL and
503 otherwise, with no secrets. Allow enough startup time for Neon connection
establishment. Because the endpoint depends on the database, avoid aggressive
liveness probes that restart every instance during a shared database outage.
Probe configuration is a pending Cloud Run service setting; Docker EXPOSE does
not configure it.

Permit public HTTPS invocation so Firebase's existing rewrite can reach the
API without Google identity tokens. Hira still enforces its session and role
checks on protected routes. CORS remains restricted to `WEB_ORIGIN` and
verification files remain private. PostgreSQL is not exposed by the container.

Later configure Firebase App Hosting with `NEXT_PUBLIC_API_URL=/api` and
`API_PROXY_TARGET` equal to the Cloud Run HTTPS service URL, without `/api`.
Make these available when Next.js builds its rewrites, and rebuild when the
target changes. The browser continues using the Firebase origin; the proxy
strips `/api` before forwarding. Preserve cookies and private-response cache
headers through the hosting path. No frontend files are changed here.

Backend analytics currently dispatches requests asynchronously after database
writes. Configure instance-based billing/CPU outside requests to avoid freezing
in-flight captures after an HTTP response; analytics remains best-effort and
is not guaranteed across instance termination. This is an operator setting,
not an application retry or queue change.

Before deployment, build and exercise the container, configure secrets, apply
migrations, establish Neon backups, verify private storage and email access,
and verify Firebase cookie/proxy behavior. These checks have not been run in
this preparation. Error monitoring remains the separate pending integration
described in the production runbook.

References: [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract),
[CPU/billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings),
[pnpm deploy](https://pnpm.io/cli/deploy).
