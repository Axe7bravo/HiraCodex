import { SiteHeader } from "@/components/site-header";
import { AccountClient } from "./account-client";

export default function AccountPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell">
        <AccountClient />
      </div>
    </main>
  );
}
