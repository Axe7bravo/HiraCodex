# Hira V1 Controlled Build Order

The goal is to keep the codebase understandable and to prove the marketplace loop early.

## Milestone 0 — Repository and developer environment

Deliverables:

- monorepo or clearly separated `web` and `api` apps;
- Next.js frontend;
- NestJS backend;
- PostgreSQL + Prisma;
- environment-variable templates;
- lint/typecheck/test commands;
- local seed data;
- basic CI;
- health endpoint;
- shared conventions documented.

Exit criteria: frontend can call backend health endpoint; backend can read/write the development database.

## Milestone 1 — Authentication and roles

Build only:

- tenant registration;
- landlord registration;
- sign in/out;
- password reset;
- secure session handling;
- tenant/landlord/admin route authorization;
- basic profile shell.

Exit criteria: role boundaries are covered by automated tests.

## Milestone 2 — Verification

Build:

- student document submission;
- landlord identity-document submission;
- secure object/file storage;
- pending/approved/rejected statuses;
- admin review queue;
- verification badges derived from real status.

Exit criteria: user cannot read another user's private verification document without authorization.

## Milestone 3 — Property listings

Build:

- landlord create/edit/draft/submit listing;
- property photos;
- structured area/location text without maps;
- room/property attributes;
- amenities;
- availability;
- admin property approval;
- active/inactive status.

ADMIN self-review is permitted in V1 and remains audited; ADMIN-owned listings use the same submission and moderation lifecycle as other listings.

Exit criteria: landlord creates a listing -> admin approves -> listing appears publicly.

## Milestone 4 — Discovery

Build:

- homepage listing feed;
- search results;
- price, area/institution, room type, availability and amenity filters;
- property detail;
- favourites/saved properties.

Exit criteria: tenant can find and save an approved property on mobile and desktop.

## Milestone 5 — Inquiry and request loop

Build:

- simple inquiry form;
- landlord inquiry inbox;
- accommodation request when appropriate;
- pending/accepted/declined/cancelled state changes;
- optional contact/follow-up field if agreed;
- email notifications if configured;
- tenant and landlord status views.

No real-time chat.

Exit criteria: tenant sends inquiry -> landlord sees it -> landlord responds/accepts/declines -> tenant sees updated status.

## Milestone 6 — Dashboards and admin operations

Build only the information required for V1 operations:

- tenant dashboard;
- landlord dashboard;
- admin queues;
- lightweight marketplace counters.

Do not build financial dashboards.

## Milestone 7 — Production hardening and beta

- mobile/responsive QA;
- accessibility pass;
- rate limiting;
- secure headers/CORS/cookies;
- file-upload validation;
- database backups;
- error monitoring;
- analytics events;
- seed/beta data cleanup;
- end-to-end smoke tests;
- deployment docs.

Analytics uses the explicit, privacy-minimised events documented in
`docs/implementation/ANALYTICS.md` and remains disabled when provider
configuration is absent.

## Development rule

Each milestone should be a small set of reviewable commits. Do not start the next major module until the current vertical slice works end to end and its code path can be explained from UI -> API -> service -> database -> response.
