import { SiteHeader } from "@/components/site-header";
import { AdminPropertyQueue } from "./property-queue";

export default function AdminPropertiesPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell">
        <AdminPropertyQueue />
      </div>
    </main>
  );
}
