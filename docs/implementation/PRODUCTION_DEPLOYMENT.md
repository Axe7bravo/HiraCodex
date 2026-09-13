# Hira V1 production deployment

For the selected Cloud Run API / Neon / Firebase App Hosting topology, see
[Cloud Run preparation](CLOUD_RUN.md). The portable requirements below still apply.

This runbook describes repository requirements only. It does not provision or
select hosting, PostgreSQL, object storage, email, analytics, monitoring, or
backup providers.

## Required services

- A Node.js 22 host for the Next.js web application.
- A Node.js 22 host for the NestJS API.
- PostgreSQL reachable only by the API and authorized operators.
- Private S3-compatible object storage for verification documents and property
  photos. Buckets do not need to be public; files are delivered by authorized
  API routes.
- A Resend account and verified sender identity for transactional email.
- Optional PostHog projects for the existing explicit V1 analytics events.
- An error-monitoring provider. No provider SDK is currently integrated.

## Production environment

### Web

Required:

- `NODE_ENV=production` (normally set by the hosting runtime).
- `NEXT_PUBLIC_API_URL=/api` for the recommended same-origin model. The code
  also falls back to `/api` in production.
- `API_PROXY_TARGET`: server-only HTTP(S) origin of the NestJS API, reachable
  from the Next.js host. It is required in production and must not include the
  browser `/api` prefix unless the upstream API itself uses that prefix.

Optional:

- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`: both are required to
  enable browser analytics; otherwise analytics is a no-op. Use an ingestion
  key, never a personal/admin key.

Development only:

- `EXTERNAL_DEV_ORIGIN`: exact temporary HTTP(S) origin allowed to load Next.js
  development assets. It has no production effect.

### API

Required:

- `NODE_ENV=production`.
- `PORT`: listening port supplied by the host.
- `DATABASE_URL`: production PostgreSQL connection string. Keep it secret.
- `WEB_ORIGIN`: exact HTTPS web origin with no path, query, credentials, or
  fragment. It controls credentialed CORS and password-reset link origins.
- `JWT_SECRET`: long, random production secret with no shared development value.
- `RESEND_API_KEY` and `EMAIL_FROM`: provider credential and verified sender.
- `VERIFICATION_STORAGE_DRIVER=s3`.
- `VERIFICATION_S3_REGION`, `VERIFICATION_S3_BUCKET`,
  `VERIFICATION_S3_ACCESS_KEY_ID`, and
  `VERIFICATION_S3_SECRET_ACCESS_KEY`.
- `PROPERTY_STORAGE_DRIVER=s3`.
- `PROPERTY_S3_REGION`, `PROPERTY_S3_BUCKET`,
  `PROPERTY_S3_ACCESS_KEY_ID`, and `PROPERTY_S3_SECRET_ACCESS_KEY`.

Required when the S3 provider uses a custom API endpoint (for example R2):

- `VERIFICATION_S3_ENDPOINT`.
- `PROPERTY_S3_ENDPOINT`.

Optional:

- `POSTHOG_API_KEY` and `POSTHOG_HOST`: both enable server analytics; otherwise
  analytics is a no-op.

Development only:

- `VERIFICATION_LOCAL_STORAGE_DIR` and `PROPERTY_LOCAL_STORAGE_DIR`.
  Production startup rejects local storage drivers.

## Networking, cookies, and private files

The recommended topology is one browser origin. The browser calls `/api/*` on
the HTTPS web origin. Next.js removes `/api` and rewrites to
`API_PROXY_TARGET`; NestJS routes remain unchanged. This prevents API localhost
addresses from reaching production browsers and keeps cookies first-party.

NestJS permits credentialed CORS only from `WEB_ORIGIN`; wildcard credentialed
CORS is not used. The session cookie is host-only, HttpOnly, SameSite=Lax,
Secure in production, and scoped to `/`. Authentication and authorization are
still enforced by NestJS.

Property photos use the controlled discovery routes and remain compatible with
Next/Image optimization. Verification documents remain private and are fetched
with session credentials through authorized endpoints. Object keys and bucket
details are not browser URLs. Next.js permits private/local-IP image upstreams
only in development; production SSRF protection remains enabled.

## Build and deployment order

1. Provision provider-side services and backups; create least-privilege runtime
   credentials.
2. Configure API and web environment values in the hosting secret stores.
3. Install dependencies with the committed pnpm lockfile.
4. Generate Prisma Client: `pnpm --dir apps/api prisma:generate`.
5. Build both applications: `pnpm --dir apps/api build` and
   `pnpm --dir apps/web build`.
6. Apply committed migrations once from a controlled release job:
   `pnpm --dir apps/api prisma:migrate:deploy`.
7. Start the API with `pnpm --dir apps/api start:prod`.
8. Start the web application with `pnpm --dir apps/web start`.
9. Verify `GET /health` through the deployed API path and complete the critical
   authentication, private-document, property-image, and marketplace smoke
   flows.

Never use `prisma db push`, `prisma migrate dev`, Prisma Studio, database reset,
or `seed:dev` against production.

## Health and monitoring

`GET /health` is unauthenticated and checks the API process plus a minimal
Prisma query. It returns only API/database reachability and no credentials or
environment details. Configure the hosting health check against this route.

Application error monitoring is still a deployment decision: Sentry or an
equivalent provider is required by the PRD, but no SDK is currently installed.
Until it is integrated, retain and ship platform logs from both applications;
do not treat analytics as error monitoring.

## Backups and restore

Backups are not configured by this repository. Before launch, the operator must:

- enable automated encrypted PostgreSQL backups with a documented retention
  period and point-in-time recovery where supported;
- restrict backup access and store credentials outside the repository;
- configure object-storage versioning or an equivalent recovery policy;
- perform and record a restore rehearsal into an isolated non-production
  database and bucket;
- document the provider-specific restore owner, recovery point objective, and
  recovery time objective.

Never restore over production as the first recovery test. Verify schema,
record counts, private-document access, and representative marketplace flows in
the isolated restore before promoting a recovery.

## Rollback principles

- Treat migrations as forward-only. Review migrations before deployment and
  take/verify a recoverable backup before destructive data changes.
- Roll back application code only when the previous version is compatible with
  the already-applied database schema.
- If it is not compatible, deploy a corrective forward migration/application
  release or follow the rehearsed provider restore procedure.
- Do not automatically reset, reseed, or run development fixtures in recovery.
- Record the deployed commit, migration state, environment changes, and smoke
  check result for every release.

## Pre-launch provider actions still required

- Select production web/API/PostgreSQL/object-storage hosts.
- Configure PostgreSQL networking, automated backups, and restore rehearsal.
- Create private buckets and least-privilege S3-compatible credentials.
- Verify the Resend sender domain and production sending permissions.
- Create analytics projects if analytics will be enabled.
- Select and integrate error monitoring, then configure alert ownership.
- Terminate HTTPS at the public web origin and verify the web-to-API transport.
