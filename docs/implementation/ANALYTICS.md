# Hira V1 analytics

Hira V1 uses explicit, best-effort PostHog capture events to measure the core
marketplace funnel. Instrumentation does not mean analytics is active in a
deployed environment: both the key and host must be configured for the relevant
application. Missing configuration safely disables capture.

## Configuration

API:

- `POSTHOG_API_KEY` — PostHog project ingestion key.
- `POSTHOG_HOST` — PostHog instance host.

Web:

- `NEXT_PUBLIC_POSTHOG_KEY` — browser-safe PostHog project ingestion key.
- `NEXT_PUBLIC_POSTHOG_HOST` — PostHog instance host.

Never place a PostHog personal API key or administration key in a
`NEXT_PUBLIC_` variable.

## Event ownership

The web application owns successful public discovery and detail-view events:

- `property_search`
- `property_viewed`

The API owns successful persisted business events:

- `registration_completed`
- `verification_submitted`
- `verification_approved`
- `property_created`
- `property_submitted_for_review`
- `property_approved`
- `favourite_added`
- `favourite_removed`
- `inquiry_created`
- `accommodation_request_created`
- `accommodation_request_accepted`
- `accommodation_request_declined`
- `accommodation_request_cancelled`

Provider failures are caught inside the analytics boundary and never change the
result of the underlying product operation. The API logs only the first delivery
failure for a service instance to avoid repeated noise.

## Privacy boundary

Capture is explicit. Hira does not enable autocapture, session replay, form or
keystroke capture, or console recording. Events contain stable internal IDs and
coarse structured marketplace properties only. They must not contain names,
email addresses, passwords, tokens, document data or URLs, inquiry messages,
request notes, rejection reasons, or other free-form profile content.

Property search records only allow-listed area, institution and room-type
values, whether filters are active, and the result count. Anonymous browser
events use a locally stored random identifier and do not require authentication.

Placement remains a manual operational metric in V1 because the final viewing,
agreement and placement happen outside Hira.
