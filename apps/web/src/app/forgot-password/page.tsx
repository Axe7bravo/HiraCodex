import { SiteHeader } from "@/components/site-header";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <section className="single-auth">
        <div className="auth-card">
          <div className="brand brand-card">
            Hira<span>.</span>
          </div>
          <p className="eyebrow">Account recovery</p>
          <h1>Forgot your password?</h1>
          <p className="muted">
            Enter your email and we’ll send instructions if it matches a Hira
            account.
          </p>
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}
