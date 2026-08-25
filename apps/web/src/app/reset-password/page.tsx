import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <section className="single-auth">
        <div className="auth-card">
          <div className="brand brand-card">
            Hira<span>.</span>
          </div>
          <p className="eyebrow">Secure your account</p>
          <h1>Choose a new password</h1>
          <p className="muted">
            Your reset link can be used once and expires after one hour.
          </p>
          <Suspense fallback={<p>Loading form…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
