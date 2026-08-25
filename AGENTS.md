# Hira repository instructions

Hira V1 is a verified student-housing marketplace for Maseru, Lesotho.

## Read before coding

1. `docs/product/HIRA_V1_PRD.md`
2. `docs/design/design.md`
3. `docs/design/SCREEN_MANIFEST.md`
4. `docs/implementation/BUILD_ORDER.md`

The PRD is the functional source of truth. Mockups are visual references only.

## Non-negotiable V1 boundaries

Do not add M-Pesa/payments, subscriptions, payouts, commission accounting, maps, real-time chat/WebSockets, roommate matching, digital leases, app-store/native-app functionality, property boosting, automated property management, virtual tours, video calls, or Redis without an explicit scope change.

Do not implement a feature solely because it appears in a reference image.

## Engineering approach

- Work in small vertical slices.
- Before editing, state the files/modules you expect to touch and the request/data flow.
- Prefer boring, explicit code over clever abstraction.
- Keep business logic in services/domain modules, not React components or controllers.
- Enforce authorization in the backend even when the frontend hides an action.
- Verification documents are private data; use least-privilege access.
- Never trust status or role values sent by the client.
- Keep third-party integrations behind adapters/services.
- Do not introduce infrastructure before there is a concrete V1 need.

## Frontend

- Mobile-first.
- Follow `docs/design/design.md`.
- Reuse components and tokens rather than copying styles screen by screen.
- All async screens require loading, error and empty states.
- Accessibility and visible focus states are required.

## Backend

- NestJS + TypeScript.
- PostgreSQL + Prisma.
- Validate request DTOs.
- Use explicit role/ownership checks.
- Make state transitions auditable and test invalid transitions.

## Completion requirements for every task

Run the relevant project commands for:

- formatting/lint;
- type checking;
- unit/integration tests;
- build;
- relevant smoke or end-to-end test.

Report what changed, what was tested, and any remaining risk. Do not silently ignore failing checks.

## Visual implementation tasks

When implementing a referenced screen, compare a local screenshot against the reference before declaring the task complete. Fix visual differences without adding functionality excluded by the PRD.

## Engineering principles

Apply software design principles pragmatically. Simplicity and
maintainability take priority over theoretical purity.

### KISS

- Choose the simplest implementation that correctly satisfies the
  current requirement.
- Prefer readable and explicit code over clever or compressed code.
- Avoid unnecessary layers, patterns, libraries, and abstractions.
- A future requirement is not a current requirement.

### YAGNI

- Do not build functionality for hypothetical future needs.
- Do not create extension points until there is a concrete use case.
- Do not introduce infrastructure or abstractions merely because they
  may be useful later.
- Implement only what the current V1 requirement needs.

### DRY

- Avoid duplicating business rules, validation rules, constants,
  shared UI primitives, and domain knowledge.
- Extract shared code when duplication represents the same concept.
- Do not remove duplication merely to reduce line count.
- Prefer small duplication over a premature or misleading abstraction
  when two concepts may evolve independently.

### SOLID

Apply SOLID principles where they improve clarity and testability:

- Keep modules, classes, functions, and components focused on one
  responsibility.
- Keep controllers thin. Business rules belong in services/domain
  modules.
- Depend on stable boundaries for external services.
- Prefer composition over inheritance.
- Keep interfaces small and purpose-specific.
- Do not create interfaces, factories, repositories, or abstraction
  layers unless they solve a concrete problem.

### NestJS and Prisma

- Organize backend code around Hira domain capabilities rather than
  technical abstractions.
- Controllers handle HTTP concerns and delegate business logic.
- Services contain application/business rules.
- Prisma handles persistence.
- Do not create a generic repository layer over Prisma unless a real
  requirement justifies it.
- Keep database queries close to the domain/service that owns them.
- Use transactions when one business operation requires multiple
  database writes to succeed or fail together.

### Next.js / React

- Prefer reusable focused components over large page components.
- Extract shared components when they have a clear reusable purpose.
- Do not create a component for every small piece of markup.
- Keep server state, client state, and UI state conceptually separate.
- Avoid global state unless multiple unrelated parts of the
  application genuinely need it.
- Prefer platform and framework capabilities before adding another
  dependency.

### General quality rule

When choosing between two implementations that satisfy the same
requirement, prefer the one that:

1. is easier to understand;
2. has fewer moving parts;
3. is easier to test;
4. introduces fewer dependencies;
5. is easier to change later.

Whenever introducing a new architectural abstraction, dependency,
design pattern, or infrastructure component that did not previously
exist, explain why it is necessary for the current requirement.

If the same requirement can reasonably be satisfied without the new
abstraction, prefer the simpler implementation.