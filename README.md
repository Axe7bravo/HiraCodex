# Hira V1

Hira is a verified student-housing marketplace for Maseru, Lesotho. Milestone 0 proves the local connection from Next.js through NestJS and Prisma to PostgreSQL.

## Local development

Prerequisites are Node.js 22, pnpm, and the existing local PostgreSQL `hira` database. Keep the real connection string in `apps/api/.env`; use the committed `.env.example` files only as templates.

Install and prepare the database:

```powershell
pnpm install
pnpm --dir apps/api prisma:generate
pnpm --dir apps/api prisma:migrate
```

Run the API and web app in separate terminals:

```powershell
pnpm --dir apps/api start:dev
pnpm --dir apps/web dev
```

Open `http://localhost:3000`. The page calls `http://localhost:4000/health` and reports whether PostgreSQL is reachable through Prisma. You can independently check the backend with:

```powershell
Invoke-RestMethod http://localhost:4000/health
pnpm --dir apps/api exec prisma migrate status
```

Run all project checks:

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm --dir apps/api test:e2e
pnpm build
```

## Product source of truth

- Product: `docs/product/HIRA_V1_PRD.md`
- Design: `docs/design/design.md`
- Visual manifest: `docs/design/SCREEN_MANIFEST.md`
- Build order: `docs/implementation/BUILD_ORDER.md`
- Persistent repository instructions: `AGENTS.md`
