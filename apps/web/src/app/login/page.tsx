import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Hira"
      copy="Continue your housing search, manage your listings or review your Hira activity."
      mode="login"
    >
      <Suspense fallback={<p className="auth-form-loading">Loading form…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
