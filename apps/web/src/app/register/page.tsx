import { SiteHeader } from "@/components/site-header";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <section className="auth-layout">
        <div className="auth-copy">
          <p className="eyebrow">Join Hira</p>
          <h1>Create your account</h1>
          <p>
            Choose how you’ll use Hira and take the first step toward trusted
            student housing.
          </p>
          <div className="trust-note">
            <strong>Built around trust.</strong>
            <span>Verified students. Trusted landlords. Safer housing.</span>
          </div>
        </div>
        <div className="auth-card">
          <div className="brand brand-card">
            Hira<span>.</span>
          </div>
          <h2>Create your account</h2>
          <p className="muted">
            No verification documents are needed at this stage.
          </p>
          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
