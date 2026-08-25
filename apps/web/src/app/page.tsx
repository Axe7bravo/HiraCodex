import { ApiStatus } from "./status/api-status";

export default function Home() {
  return (
    <main className="status-shell">
      <section className="status-card" aria-labelledby="status-title">
        <p className="eyebrow">Hira V1 · Milestone 0</p>
        <h1 id="status-title">Development status</h1>
        <p className="intro">
          This diagnostic checks the complete local path from Next.js to NestJS,
          Prisma, and PostgreSQL.
        </p>
        <ApiStatus />
      </section>
    </main>
  );
}
