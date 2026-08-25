import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <section className="single-auth">
        <div className="auth-card">
          <div className="brand brand-card">
            Hira<span>.</span>
          </div>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to Hira</h1>
          <p className="muted">Access your secure Hira account.</p>
          <Suspense fallback={<p>Loading form…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
