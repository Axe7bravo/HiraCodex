You are beginning implementation of Hira V1.

Before changing any files:

1. Read AGENTS.md.
2. Read the Hira V1 PRD under docs/product.
3. Read docs/design/design.md.
4. Inspect the repository structure.
5. Explain the architecture you propose for this milestone.

Existing environment:

- Node.js 22
- pnpm workspace
- Next.js frontend at apps/web
- NestJS backend at apps/api
- PostgreSQL already running locally in Docker
- Container name: postgres-db
- PostgreSQL host port: 5432
- PostgreSQL user: myuser
- Database: hira
- DATABASE_URL is supplied through apps/api/.env

DO NOT:

- install PostgreSQL
- create PostgreSQL containers
- add PostgreSQL to Docker Compose
- alter unrelated databases
- implement authentication
- implement listings
- implement inquiries
- implement verification
- implement UI screens
- implement any other Hira feature

For this milestone only:

1. Add Prisma to the backend.
2. Configure Prisma using DATABASE_URL.
3. Establish the initial Hira V1 domain schema based strictly on the PRD.
4. Generate and apply the first migration to the `hira` database only.
5. Create a clean NestJS database/Prisma integration.
6. Create GET /health.
7. The health endpoint must verify that the API can reach PostgreSQL.
8. Add a minimal frontend development page that calls the NestJS health endpoint and visibly reports API/database status.
9. Configure the minimum CORS/environment handling required for localhost development.
10. Add appropriate tests.

Do not begin Milestone 1.

When finished, explain:

- every major file you created
- what each file is responsible for
- how NestJS connects to Prisma
- how Prisma connects to PostgreSQL
- how Next.js reaches NestJS
- how to run the system locally
- how to verify the database connection manually