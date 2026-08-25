HIRA

Product Requirements Document

Verified Student Housing Marketplace — Lean V1

| Document | Details |
| --- | --- |
| Version | 2.0 — Lean V1 Scope |
| Date | 20 August 2026 |
| Status | Draft for Development |
| Product | Hira |
| Primary Market | Maseru, Lesotho |
| Product Type | Mobile-first responsive web marketplace |
| Supersedes | Hira PRD v1.0 (18 January 2026) for V1 development scope |

| V1 PRODUCT PRINCIPLE Prove that Hira can connect verified students with verified landlords and help them progress from property discovery to a genuine accommodation opportunity. Everything else is deferred until users demonstrate a need for it. |
| --- |

Development posture

- Simple before sophisticated
- Manual before automated
- Measured before monetized
- Understandable code before maximum implementation speed

# Document Control

This PRD defines the reduced Hira V1 scope agreed after reviewing the original 73-page specification. It intentionally removes integrations and automation that are not required to validate the core marketplace.

| Item | Decision |
| --- | --- |
| V1 objective | Validate the verified student-housing marketplace loop |
| Payments | Deferred — no M-Pesa integration in V1 |
| Maps | Deferred — capture structured location data, no map UI |
| Realtime chat | Deferred — use structured inquiries and contact handoff |
| Monetisation | Deferred — launch beta free |
| PWA extras | Deferred — responsive mobile web first |
| Property management automation | Deferred — operational/manual where needed |

## Contents

1. Executive Summary

2. Product Goals and Non-Goals

3. Target Users and Roles

4. V1 Scope

5. Core User Journeys

6. Functional Requirements

7. UX Requirements

8. Technical Architecture

9. Data Model

10. API Surface

11. Non-Functional Requirements

12. Analytics and Success Metrics

13. Definition of Done

14. Development Plan

15. Beta Launch Plan

16. Risks and Mitigations

17. Deferred Roadmap

18. Open Questions

# 1. Executive Summary

## 1.1 Product Overview

Hira is a mobile-first housing marketplace for tertiary students and young professionals in Maseru, Lesotho. It connects accommodation seekers with verified landlords and verified property listings, reducing the uncertainty and inefficiency of finding rooms through social-media groups, booking agents, and word of mouth.

The original product vision included payments, subscriptions, realtime chat, maps, automated property management, lease workflows, PWA offline features, and later ecosystem services. V1 deliberately narrows the product to the minimum trusted marketplace required to test demand and user behaviour.

## 1.2 V1 Hypothesis

| CORE HYPOTHESIS If students can browse credible accommodation from verified landlords and easily submit an inquiry or accommodation request, and landlords can list rooms and respond to verified students, Hira can create enough trust and convenience to replace part of the current Facebook/agent workflow. |
| --- |

## 1.3 V1 Marketplace Loop

The product is successful if this loop works reliably:

1. Landlord registers and is verified.
1. Landlord creates a property listing and submits it for approval.
1. Admin approves the listing.
1. Tenant registers and can optionally complete student verification.
1. Tenant discovers a suitable property using basic filters.
1. Tenant sends an inquiry or accommodation request.
1. Landlord reviews the tenant and responds.
1. The parties progress to a viewing or placement outside the platform.
1. Hira records the funnel outcome for validation.

## 1.4 V1 Product Positioning

Hira V1 is not a payments platform, property-management suite, or rental accounting system. It is a verified discovery and lead-conversion marketplace with light workflow support.

# 2. Product Goals and Non-Goals

## 2.1 Goals

- Create a trusted pool of verified landlords and students.
- Let landlords create professional, structured room/property listings without technical difficulty.
- Let tenants quickly discover rooms by price, area, institution proximity, availability, room type, and amenities.
- Give tenants a simple path from interest to inquiry or accommodation request.
- Give landlords a simple path from inquiry to response and accepted opportunity.
- Give Hira administrators operational control over verification, listings, and users.
- Collect enough marketplace funnel data to determine what should be automated or monetized next.
- Keep the codebase small, understandable, and easy to extend.

## 2.2 Non-Goals for V1

| Deferred Capability | Reason for Deferral |
| --- | --- |
| M-Pesa / Ecocash payments | High integration risk; not required to validate marketplace demand. |
| Rent collection / deposits | Creates financial, reconciliation, and regulatory complexity before demand is proven. |
| Commission automation | Depends on in-platform payments. Track commercial arrangements operationally first. |
| Interactive maps / Mapbox | Useful but not required for early discovery; location can be represented structurally. |
| Realtime in-app chat | Socket infrastructure, moderation, unread state, and notifications add complexity. |
| Push notifications / offline PWA | Responsive web + email is sufficient for initial beta. |
| Tenant premium subscription / paywall | Early marketplace needs liquidity more than monetisation. |
| Digital lease signing | Can remain outside Hira during validation. |
| Reviews and ratings | Not valuable until completed stays exist in meaningful volume. |
| Full property management | Operational service and automation should follow validated landlord demand. |
| Roommate matching / virtual tours / forums | Phase 2+ engagement features, not marketplace-critical. |

# 3. Target Users and Roles

## 3.1 Tenant

Primary V1 tenant: tertiary student seeking safe, affordable accommodation in or around Maseru. Young professionals may use the marketplace, but V1 product decisions should prioritize the student use case.

- Search by budget and practical location context.
- See enough information to judge whether a room is suitable.
- Know whether a landlord/listing has been verified.
- Save interesting properties.
- Send an inquiry or accommodation request.
- Track the status of submitted requests.

## 3.2 Landlord

- Register and establish a landlord profile.
- Submit identity information for Hira verification.
- Create, edit, pause, and remove listings.
- Upload property photos and structured details.
- Receive tenant inquiries and accommodation requests.
- Review tenant verification status.
- Accept, decline, or follow up outside Hira.

## 3.3 Administrator

- Review and approve/reject student verification requests.
- Review and approve/reject landlord verification requests.
- Review and approve/reject property listings.
- Manage users and listing statuses.
- View inquiry/request activity and marketplace health.
- Resolve reports or remove fraudulent/inappropriate content.

## 3.4 Role Permissions Summary

| Capability | Tenant | Landlord | Admin |
| --- | --- | --- | --- |
| Browse active listings | Yes | Yes | Yes |
| Create property listing | No | Yes | Yes |
| Submit student verification | Yes | No | No |
| Submit landlord verification | No | Yes | No |
| Send inquiry/request | Yes | No | No |
| Respond to own inquiries | No | Yes | No |
| Approve verification/listings | No | No | Yes |
| Manage any user/listing | No | No | Yes |

# 4. V1 Scope

## 4.1 Must-Have Capabilities

| Area | V1 Requirement |
| --- | --- |
| Authentication | Email/password registration, login, logout, password reset, tenant/landlord/admin roles. |
| Profiles | Basic tenant and landlord profiles with verification state. |
| Verification | Student document upload; landlord ID upload; manual admin review. |
| Listings | Create/edit/delete/pause; draft and review states; 3–10 photos; price, room type, amenities, availability, structured location. |
| Discovery | Active listing feed, property detail page, basic filters, sorting, pagination. |
| Favourites | Tenant can save/remove properties. |
| Inquiries | Tenant sends a structured message of interest to landlord. |
| Accommodation Requests | Tenant submits a simple request; landlord accepts/declines; tenant can cancel. |
| Dashboards | Tenant, landlord, and admin views focused on their active workflows. |
| Email | Transactional email for high-value state changes. |
| Analytics | Capture funnel events needed to measure marketplace validation. |
| Deployment | Production web frontend, API, database, object storage, monitoring, backups. |

## 4.2 Nice-to-Have Only if Core Scope Is Stable

- Share listing link.
- Simple “recently viewed” section.
- Admin CSV export of users/listings/inquiries.
- Basic listing view counters.
- Landlord response note or contact preference.
- Waitlist or invite-code support for controlled beta.
| SCOPE GUARDRAIL Nice-to-have items must not delay the first end-to-end marketplace loop. If a feature threatens the agreed beta date, it moves to the deferred backlog. |
| --- |

# 5. Core User Journeys

## 5.1 Tenant Journey

| Step | Expected Experience |
| --- | --- |
| Discover Hira | Open landing page and browse active listings. |
| Register | Create tenant account using email/password. |
| Complete profile | Name, phone/contact preference, institution, desired move-in period. |
| Verify student status | Upload admission/registration evidence; status remains pending until admin review. |
| Search | Filter properties by price, area, nearest institution, availability, room type, and amenities. |
| Evaluate property | View photos, price, amenities, location text, verification indicators, availability, and landlord summary. |
| Save or inquire | Favourite the property or submit a structured inquiry. |
| Request accommodation | Submit preferred move-in date and optional note. |
| Track response | See pending/accepted/declined/cancelled status. |
| Continue offline | When accepted, proceed to viewing/contact/placement through agreed contact channel. |

## 5.2 Landlord Journey

| Step | Expected Experience |
| --- | --- |
| Register | Create landlord account. |
| Verify identity | Upload ID document and wait for Hira review. |
| Create listing | Enter property data, upload photos, save draft. |
| Submit for review | Listing status changes from Draft to Pending Review. |
| Go live | Admin approves; status becomes Active and listing appears in search. |
| Receive inquiry | Landlord receives email/dashboard notification. |
| Review tenant | View tenant profile and verification status. |
| Respond | Contact/follow up, or accept/decline accommodation request. |
| Manage listing | Edit, pause, mark unavailable, or remove listing. |

## 5.3 Admin Journey

| Step | Expected Experience |
| --- | --- |
| Open queue | Dashboard shows pending student, landlord, and listing reviews. |
| Review evidence | Inspect submitted metadata/document links with access controls. |
| Decide | Approve or reject with optional reason. |
| Moderate | Suspend users/listings where fraud, abuse, or policy breaches are suspected. |
| Monitor | Track active listings, inquiries, requests, response rates, and placements recorded manually. |

# 6. Functional Requirements

## FR1 — Authentication and Access

- Separate registration choice for tenant and landlord.
- Email and password authentication.
- Secure session using HTTP-only cookies or equivalent server-managed session mechanism.
- Password reset by email.
- Role-based access enforcement on both API and frontend routes.
- Admin accounts cannot be self-registered through the public UI.

## FR2 — User Profiles

- Tenant profile: first name, last name, phone/contact method, institution, expected move-in period, verification state.
- Landlord profile: first name, last name, phone/contact method, optional organisation/property count, verification state.
- Users can update non-sensitive profile fields.
- Verification state is displayed clearly but cannot be changed by the user.

## FR3 — Verification

- Tenant can upload one or more supported documents proving student status.
- Landlord can upload a supported ID document.
- Verification lifecycle: NOT_SUBMITTED → PENDING → APPROVED or REJECTED.
- Rejected submissions may include a user-visible reason and allow resubmission.
- Verification documents are private; public URLs must not expose sensitive documents.
- Admin can review submissions and record reviewer/time/reason.

## FR4 — Property Listing Management

- Landlord can create and save listing as draft.
- Required fields: title, description, monthly price, property/room type, area, nearest institution, availability, amenities, photos.
- Minimum 3 and maximum 10 property photos for submission.
- Listing lifecycle: DRAFT → PENDING_REVIEW → ACTIVE, with REJECTED / PAUSED / INACTIVE variants.
- Only verified landlords may submit a listing for approval unless admin override is explicitly allowed.
- Landlord can edit own listings; material edits to an active listing may optionally trigger re-review.

## FR5 — Property Discovery

- Public or authenticated users can browse ACTIVE listings.
- Filters: minimum/maximum price, area, nearest institution, availability, room type, selected amenities.
- Sort: newest and price low-to-high/high-to-low.
- Pagination required; no infinite-scroll dependency for V1.
- No map UI in V1.

## FR6 — Property Detail

- Display photo gallery, price, title, description, room/property type, amenities, availability, area, nearest institution, and landlord verification state.
- Do not expose sensitive/private verification documents.
- Do not require latitude/longitude to display the page.
- Provide Favourite, Send Inquiry, and Request Accommodation actions where appropriate.

## FR7 — Favourites

- Authenticated tenants can favourite/unfavourite active properties.
- Tenant dashboard includes saved properties.
- Removing or deactivating a property must not break the tenant dashboard; unavailable properties should be labelled or omitted safely.

## FR8 — Inquiry

- Authenticated tenant can send a structured inquiry from a property page.
- Inquiry includes property, tenant, optional move-in date, and text message.
- Landlord sees inquiries for own properties only.
- Landlord may mark an inquiry as responded/closed and use the displayed contact method for follow-up.
- No realtime chat requirement in V1.

## FR9 — Accommodation Request

- Tenant can submit a request for one active property.
- Request fields: preferred move-in date, optional note.
- Lifecycle: PENDING → ACCEPTED / DECLINED / CANCELLED.
- Only the owning landlord may accept or decline.
- Tenant may cancel while pending.
- Acceptance is a marketplace workflow state, not a legally binding lease or payment confirmation.

## FR10 — Dashboards

- Tenant dashboard: verification status, saved properties, inquiries, accommodation requests.
- Landlord dashboard: verification status, listings and statuses, inquiries, accommodation requests.
- Admin dashboard: pending verification queues, pending listings, users, listing moderation, key activity counts.

## FR11 — Email Notifications

- Send email for account password reset.
- Send email for verification approved/rejected.
- Send landlord email for new inquiry/request.
- Send tenant email when request is accepted/declined.
- Email failure should be logged and must not corrupt the underlying workflow transaction.

## FR12 — Admin Moderation

- Admin may suspend a user.
- Admin may pause/deactivate a listing.
- Admin actions affecting status must be auditable at least by actor and timestamp.
- Rejected listing/verification can carry a reason.

# 7. UX Requirements

## 7.1 Product Experience Principles

- Mobile first: the primary experience must work comfortably on common smartphone widths.
- Trust is visible: verification states and listing status should be understandable without jargon.
- Low cognitive load: forms should be split into sensible steps where a single page becomes overwhelming.
- No dead ends: every empty, rejected, or pending state should tell the user what to do next.
- Conservative disclosure: personal contact and verification data should only be shown where the workflow requires it.
- Fast perceived performance: use responsive images, skeleton/loading states, and concise payloads.

## 7.2 Key Screens

| Tenant / Public | Landlord | Admin |
| --- | --- | --- |
| Landing page | Landlord onboarding | Admin login |
| Property search/results | Landlord dashboard | Overview dashboard |
| Property detail | Create/edit listing | Student verification queue |
| Register/login | Listing detail/status | Landlord verification queue |
| Tenant profile/verification | Inquiries | Listing approval queue |
| Saved properties | Accommodation requests | User/listing management |
| Tenant inquiries/requests | Landlord profile/settings | Basic metrics/activity |

## 7.3 Location Without Maps

V1 should capture location in a structured way so maps can be added later without a database redesign. The interface should favour area and institution context over exact map placement.

- Country (default Lesotho)
- City/town (default Maseru for initial market)
- Area/suburb
- Nearest tertiary institution
- Human-readable distance/transport note
- Full address stored privately if operationally required
- Optional nullable latitude/longitude reserved for future map integration

# 8. Technical Architecture

## 8.1 V1 Architecture

Use a separated frontend/backend architecture consistent with the original technical direction, but remove infrastructure that does not solve a V1 problem.

| Layer | Recommended V1 Choice | Responsibility |
| --- | --- | --- |
| Frontend | Next.js + TypeScript | Pages, forms, dashboards, data fetching, responsive UI |
| API | NestJS + TypeScript | Authentication, authorization, business rules, validation, admin workflows |
| Database | PostgreSQL + Prisma | Users, profiles, properties, verification, favourites, inquiries, requests, audit data |
| Object Storage | Cloudflare R2 or AWS S3 | Property photos and private verification documents |
| Email | Resend or equivalent | Transactional notifications |
| Monitoring | Sentry | Application error monitoring |
| Analytics | PostHog or lightweight equivalent | Marketplace funnel events |
| Hosting | Vercel + Railway/Render or equivalent | Frontend and API/database deployment |

## 8.2 Infrastructure Explicitly Not Required at Launch

- Redis
- Socket.io / WebSocket server
- Mapbox / Google Maps rendering
- M-Pesa / Ecocash SDKs
- Twilio SMS
- Web Push infrastructure
- Kubernetes
- BigQuery or dedicated analytics warehouse

## 8.3 Recommended Repository Structure

| MONOREPO hira/   apps/     web/        Next.js frontend     api/        NestJS backend   packages/     database/   Prisma schema/client     types/      Shared TypeScript contracts     config/     Shared lint/ts/config   docs/         Architecture notes and decisions |
| --- |

## 8.4 Development Method

Build in vertical slices. Each feature should be understandable end to end before the next major feature is added: UI → API route → controller → service → database → response. Codex may generate implementation, but commits should remain small and feature-scoped.

# 9. Data Model

## 9.1 Core Entities

| Entity | Purpose / Key Fields |
| --- | --- |
| User | id, email, passwordHash/session identity, role, status, firstName, lastName, contact fields, timestamps |
| TenantProfile | userId, institution, expectedMoveIn, optional profile fields |
| LandlordProfile | userId, organisation/property count optional, profile fields |
| Verification | userId, type, private document key, status, rejectionReason, reviewedBy, reviewedAt |
| Property | landlordId, title, description, price, room type, status, availability, area, nearestInstitution, optional lat/long |
| PropertyPhoto | propertyId, object-storage key/url, sortOrder |
| Favourite | tenantId, propertyId, createdAt; unique pair |
| Inquiry | propertyId, tenantId, landlordId, moveInDate optional, message, status, timestamps |
| AccommodationRequest | propertyId, tenantId, landlordId, preferredMoveInDate, note, status, timestamps |
| AdminAction / AuditLog | actorId, action, targetType, targetId, metadata, createdAt |

## 9.2 Recommended Status Enums

| Model | Statuses |
| --- | --- |
| User | ACTIVE, SUSPENDED |
| Verification | NOT_SUBMITTED, PENDING, APPROVED, REJECTED |
| Property | DRAFT, PENDING_REVIEW, ACTIVE, REJECTED, PAUSED, INACTIVE |
| Inquiry | OPEN, RESPONDED, CLOSED |
| AccommodationRequest | PENDING, ACCEPTED, DECLINED, CANCELLED |

## 9.3 Data-Modelling Principles

- Use explicit status fields instead of collections of overlapping booleans.
- Do not model payments, commissions, transaction ledgers, or leases in V1 unless required by an actual launched workflow.
- Store object-storage keys or private references rather than assuming every uploaded document should have a public URL.
- Use database constraints for uniqueness and ownership assumptions where possible.
- Keep optional latitude/longitude so maps can be added later without changing the property identity model.

# 10. API Surface

Exact route naming may change during implementation; the following surface defines the V1 capability boundary.

| Area | Representative Endpoints |
| --- | --- |
| Auth | POST /auth/register, POST /auth/login, POST /auth/logout, POST /auth/forgot-password, POST /auth/reset-password |
| Me/Profile | GET /users/me, PATCH /users/me |
| Verification | POST /verifications, GET /verifications/me, GET/PATCH /admin/verifications/:id |
| Properties | GET /properties, GET /properties/:id, POST /properties, PATCH /properties/:id, DELETE /properties/:id |
| Property workflow | POST /properties/:id/submit, PATCH /admin/properties/:id/status |
| Photos | POST /properties/:id/photos, DELETE /properties/:id/photos/:photoId |
| Favourites | GET /favourites, POST /favourites/:propertyId, DELETE /favourites/:propertyId |
| Inquiries | POST /properties/:id/inquiries, GET /inquiries, PATCH /inquiries/:id/status |
| Requests | POST /properties/:id/requests, GET /requests, PATCH /requests/:id/accept, /decline, /cancel |
| Admin | GET /admin/overview, GET /admin/users, PATCH /admin/users/:id/status |

## 10.1 Authorization Rules

- Every write endpoint must authorize ownership/role server-side; UI hiding is not security.
- Landlords can only edit listings they own.
- Tenants can only manage their own favourites, inquiries, and requests.
- Landlords can only view/respond to inquiries and requests linked to their own properties.
- Verification documents are accessible only to the submitting user where necessary and authorized admins.
- Admin routes require ADMIN role regardless of frontend route protection.

# 11. Non-Functional Requirements

## 11.1 Security

- HTTPS only in production.
- Passwords hashed with a modern password-hashing algorithm supported by the chosen auth implementation.
- HTTP-only, Secure cookies where session cookies are used.
- Server-side role/ownership checks for every protected action.
- Rate limiting on authentication and upload endpoints.
- File type and size validation before object storage.
- Private access controls for verification documents.
- Input validation at API boundaries.
- Do not log passwords, session tokens, or uploaded identity documents.

## 11.2 Performance

- Primary mobile pages should feel usable on typical mobile data connections.
- Responsive image sizes and lazy loading for listing galleries.
- Paginate property and admin tables.
- Avoid adding Redis until measured database/API performance justifies it.
- Use database indexes for commonly filtered fields such as status, price, area, nearest institution, landlordId, and createdAt.

## 11.3 Reliability and Operations

- Automated database backups.
- Application error monitoring.
- Structured server logs with request correlation where practical.
- Database migrations committed to source control.
- Staging or preview environment before production releases.
- Critical user workflows covered by automated tests plus a pre-release smoke test checklist.

## 11.4 Accessibility and Mobile

- Keyboard-accessible forms and controls.
- Labels and error text for form fields.
- Sufficient colour contrast.
- Touch targets suitable for mobile.
- Responsive layouts from small smartphone width through desktop.
- Semantic headings and basic screen-reader support.

## 11.5 Privacy

- Collect only information needed for the marketplace workflow.
- Separate public profile information from private verification data.
- Provide an operational path to delete/deactivate accounts and associated personal data where legally appropriate.
- Do not sell user data.
- Publish clear Terms, Privacy Policy, and verification/document-handling notices before public launch.

# 12. Analytics and Success Metrics

V1 metrics should validate marketplace behaviour rather than revenue. Payments and premium-conversion metrics are intentionally excluded.

## 12.1 North-Star Funnel

| MARKETPLACE FUNNEL Active Listing → Property View → Inquiry / Request → Landlord Response → Viewing / Placement |
| --- |

## 12.2 Core Metrics

| Metric | Why It Matters |
| --- | --- |
| Registered tenants | Top-of-funnel student demand |
| Verified tenants | Trust participation and verification friction |
| Registered landlords | Supply acquisition |
| Verified landlords | Quality/trust supply |
| Active listings | Marketplace liquidity |
| Property views per listing | Demand distribution |
| Favourite rate | Intent signal |
| Inquiry rate | Discovery-to-intent conversion |
| Accommodation request rate | High-intent conversion |
| Landlord response rate | Supply responsiveness |
| Median time to response | Marketplace service quality |
| Accepted requests | Strong match signal |
| Placements (manual/admin-confirmed initially) | Ultimate marketplace validation |

## 12.3 Suggested Early Validation Thresholds

These are product-learning thresholds, not contractual KPIs. They should be revised after the first beta cohort.

- Enough active listings that a student can compare multiple realistic options in the targeted areas/institutions.
- A meaningful share of active listings receive at least one inquiry.
- Most landlords with inquiries respond within a reasonable operational window.
- Students complete verification without excessive abandonment.
- The team can identify real placements that originated on Hira.

# 13. Definition of Done for V1 Beta

V1 is ready for controlled beta when the following end-to-end scenarios work in production-like conditions.

| Scenario | Acceptance Criteria |
| --- | --- |
| Tenant account | Tenant can register, login, logout, reset password, edit profile, and see correct role-protected screens. |
| Landlord account | Landlord can register, login, edit profile, and cannot access tenant/admin-only actions. |
| Student verification | Tenant uploads document; admin reviews; approval/rejection appears correctly to tenant. |
| Landlord verification | Landlord uploads ID; admin reviews; verified status gates listing submission if configured. |
| Listing lifecycle | Landlord creates draft with photos, submits, admin approves, active listing appears in public search. |
| Search | Tenant can filter and paginate active listings; inactive/pending listings do not leak publicly. |
| Favourite | Tenant can save/unsave active property and view saved list. |
| Inquiry | Tenant sends inquiry; correct landlord sees it; email is attempted; ownership is enforced. |
| Accommodation request | Tenant sends request; landlord accepts/declines; tenant sees state; cancellation works while pending. |
| Admin moderation | Admin can review queues, suspend a user, and pause a listing with auditable action. |
| Mobile | Core flows work on small-screen browser without horizontal scrolling or unusable controls. |
| Security smoke test | Unauthenticated/incorrect-role requests are rejected; users cannot access another user’s private records/documents. |
| Operations | Backups, error monitoring, production environment variables, and rollback/deploy process are documented. |

# 14. Development Plan

## 14.1 Recommended Build Strategy

Target a 4–7 week guided build in which Codex handles implementation-heavy work while the codebase remains understandable through small vertical slices. A more aggressive Codex-heavy implementation could reach beta sooner, but the development plan below prioritizes ownership and reliability.

| Week | Primary Deliverables |
| --- | --- |
| Week 1 — Foundation | Monorepo, environments, PostgreSQL/Prisma, NestJS, Next.js, auth, roles, protected routes, deployment skeleton. |
| Week 2 — Trust + Supply | Profiles, verification uploads/review, object storage, landlord listing CRUD, photos, listing statuses. |
| Week 3 — Discovery | Search/results, filters, property detail, favourites, responsive UI, location text model. |
| Week 4 — Conversion | Inquiries, accommodation requests, landlord response workflow, email notifications, tenant/landlord dashboards. |
| Week 5 — Operations | Admin dashboard, moderation, analytics events, audit trail, error monitoring, backups. |
| Week 6 — Hardening | Authorization review, tests, mobile QA, accessibility pass, performance, edge cases, data seeding. |
| Week 7 — Beta buffer | Fixes from internal/beta testing, onboarding polish, documentation, deployment/runbook. |

## 14.2 First-Week Milestone

| FIRST REAL PROOF By the end of the first focused build week, aim for the simplest complete supply loop: landlord registers → creates a listing → admin approves → tenant can browse the active listing. This proves the architecture before adding more workflow. |
| --- |

## 14.3 Commit / Slice Discipline

- One major capability per branch/commit series.
- Each slice includes schema/migration, API, frontend, tests, and a short architecture note where applicable.
- Do not let Codex implement unrelated deferred features “for completeness.”
- Before merging, be able to trace the request from UI to database and back.
- Keep a docs/decisions folder for important architecture decisions and tradeoffs.

# 15. Beta Launch Plan

## 15.1 Controlled Beta

Launch to a deliberately small cohort so operations and verification can remain manual while product behaviour is observed.

- Recruit a small set of cooperative landlords before broad student acquisition.
- Seed enough high-quality listings to make the tenant search experience credible.
- Onboard a limited group of students from selected institutions/communities.
- Personally observe the first verification, inquiry, and request workflows.
- Record actual placement outcomes manually if the platform cannot observe the off-platform completion event.
- Prioritize bug fixes and funnel blockers over new features during beta.

## 15.2 Beta Is Free

No tenant paywall or premium subscription should be required for the first beta. The objective is to build marketplace liquidity and learn where users find value before charging for access.

# 16. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Insufficient listings | Recruit and manually onboard supply before broad student marketing. |
| Fraudulent landlord/listing | Manual verification and listing approval; clear suspension controls. |
| Sensitive document exposure | Private object storage, authorization checks, minimal metadata exposure, secure admin access. |
| Landlords ignore inquiries | Email notification, dashboard queue, track response time, operational follow-up during beta. |
| Users immediately move to WhatsApp | Accept this during V1; measure it before deciding whether realtime chat is necessary. |
| Location context feels weak without maps | Use structured area + nearest institution + travel note; add maps only when feedback justifies it. |
| Scope creep from original PRD | Maintain explicit deferred backlog and reject features not tied to V1 acceptance criteria. |
| AI-generated code becomes opaque | Vertical slices, small commits, tests, architecture notes, and mandatory code walkthroughs. |
| Monetisation delayed | Treat validation as the objective; design later monetisation from observed user behaviour. |

# 17. Deferred Roadmap

Deferred does not mean rejected. It means the feature must earn its complexity through user evidence or operational need.

| Trigger / Evidence | Candidate Next Feature |
| --- | --- |
| Users frequently leave Hira because conversations are fragmented | Realtime in-app messaging and notification centre |
| Users struggle to judge distance to campus | Maps, geocoding, distance calculations |
| Landlords/tenants request in-platform deposit or rent handling | M-Pesa or payment-gateway integration and transaction ledger |
| Marketplace has strong liquidity and tenants perceive premium value | Subscriptions/paywall |
| Enough completed placements exist to support credible feedback | Reviews and ratings |
| Landlords request hands-off operations | Property-management workflows, maintenance, rent reminders, reporting |
| Users need legally managed workflow | Digital leases and e-signature |
| Repeated matching problems appear | Roommate matching or recommendation features |
| Users request richer remote viewing | Video calls / virtual tours |

## 17.1 Explicitly Out of V1 Codebase Unless Needed for Extension Points

- Payment transaction models
- Commission/payout engine
- Rent ledger
- Lease signing engine
- WebSocket gateway
- Service-worker offline caching
- Push subscription tables
- Map rendering components
- Vendor marketplace
- Maintenance tickets
- Roommate matching profiles
- Community forum

# 18. Open Questions Before Development Freeze

The following decisions should be resolved early, but none should expand scope without a clear reason.

1. Should browsing be fully public, or should some property detail fields require login?

2. Should student verification be optional for browsing but required before submitting an accommodation request?

3. Should landlord verification be required before creating drafts, or only before submitting a listing for approval?

4. What exact document types will Hira accept for student and landlord verification?

5. What property fields are mandatory for launch beyond the V1 minimum?

6. Should accepted requests reveal contact details automatically, or should contact details already be visible on inquiries?

7. How will Hira confirm that an off-platform viewing or placement actually occurred?

8. What geographic taxonomy should be used for Maseru areas and tertiary institutions?

9. What legal/privacy retention period should apply to rejected or expired verification documents?

10. Which email sender/domain and support contact will be used in production?

## 18.1 Development Freeze Rule

| READY TO BUILD Once the questions that affect schema, permissions, and public/private data are resolved, freeze V1 scope. New ideas go into the deferred backlog unless they fix a blocker, security issue, or failed acceptance criterion. |
| --- |

# Appendix A — V1 Scope at a Glance

| Build Now | Build Later |
| --- | --- |
| Email/password auth + roles | Social login / OTP unless required |
| Student + landlord verification | Automated identity verification |
| Listings + photo uploads | 360° tours / video hosting |
| Basic search + filters | Advanced recommendations |
| Structured location text | Interactive maps |
| Favourites | Saved-search alerts |
| Structured inquiry | Realtime chat |
| Simple accommodation request states | Payments / deposits / rent |
| Tenant/landlord/admin dashboards | Property-management suite |
| Email notifications | Push / SMS notifications |
| Responsive mobile web | Offline PWA behaviours / native apps |
| Funnel analytics | Revenue / commission analytics |

# Appendix B — Architecture Traceability Checklist

For every feature merged into V1, the developer/product owner should be able to answer:

1. What page or component starts the action?

2. What API endpoint receives it?

3. What controller validates/authorizes it?

4. What service contains the business rule?

5. What database model stores or reads the state?

6. What external service, if any, is involved?

7. What response comes back to the frontend?

8. What happens when the operation fails?

9. What test proves the critical path?

This checklist is intentionally part of the PRD because V1 is being built not only for speed, but for maintainability and codebase ownership.

END OF DOCUMENT
