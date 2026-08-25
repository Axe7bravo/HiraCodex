import { ApiStatus } from "./status/api-status";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <main className="home-page">
      <SiteHeader />
      <section className="home-hero">
        <div>
          <p className="eyebrow">Verified student housing in Maseru</p>
          <h1>A trusted place to begin your housing search.</h1>
          <p>
            Hira connects students and landlords through a safer, clearer
            marketplace.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/register">
              Create account
            </Link>
            <Link className="button button-outline" href="/login">
              Sign in
            </Link>
          </div>
        </div>
        <aside className="status-card" aria-labelledby="status-title">
          <p className="eyebrow">Development diagnostic</p>
          <h2 id="status-title">Platform connection</h2>
          <ApiStatus />
        </aside>
      </section>
    </main>
  );
}
