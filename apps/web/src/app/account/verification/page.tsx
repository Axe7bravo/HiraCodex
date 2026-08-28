import { SiteHeader } from "@/components/site-header";
import { VerificationClient } from "./verification-client";

export default function VerificationPage() {
  return (
    <main className="account-overview-page">
      <SiteHeader />
      <VerificationClient />
    </main>
  );
}
