import { SiteHeader } from "@/components/site-header";
import { VerificationClient } from "./verification-client";

export default function VerificationPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell profile-shell">
        <VerificationClient />
      </div>
    </main>
  );
}
