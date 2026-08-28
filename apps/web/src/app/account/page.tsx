import { SiteHeader } from "@/components/site-header";
import { AccountClient } from "./account-client";

export default function AccountPage() {
  return (
    <main className="auth-page account-overview-page">
      <SiteHeader />
      <div className="account-overview-shell">
        <AccountClient />
      </div>
    </main>
  );
}
