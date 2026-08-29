# Hira V1 performance baseline

The first visit to an uncompiled route in `next dev` includes development-only
route compilation and source-map work. That delay is useful developer feedback,
but it is not a production performance measurement. Use a production build and
production-like API/storage configuration for release performance assessment.

The V1 release-readiness pass made three material runtime improvements:

- concurrent `/users/me` requests now share one in-flight request, while pages
  that already loaded the profile pass it into their workspace header;
- public property detail and session requests begin in parallel;
- public property photos use Next.js responsive image optimization through the
  existing protected-by-route, publicly readable discovery photo endpoint.

Route-level loading boundaries provide immediate feedback for property,
account, and admin navigation. Existing authorization, storage access and API
response rules remain authoritative; performance work must not bypass them.
