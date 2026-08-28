import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Join Hira"
      title="Create your account"
      copy="Choose how you’ll use Hira and take the first step toward student housing in Maseru."
      mode="register"
    >
      <RegisterForm />
    </AuthShell>
  );
}
