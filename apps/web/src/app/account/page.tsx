import { SiteHeader } from "@/components/site-header";
import { AccountClient } from "./account-client";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ context?: string }> }) {
  const landlordContext = (await searchParams).context === "landlord";
  return (
    <main className="auth-page account-overview-page">
      <SiteHeader landlordContext={landlordContext} />
      <div className="account-overview-shell">
        <AccountClient landlordContext={landlordContext} />
      </div>
    </main>
  );
}
