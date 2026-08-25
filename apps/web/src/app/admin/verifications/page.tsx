import { SiteHeader } from "@/components/site-header";
import { AdminVerificationQueue } from "./verification-queue";

export default function AdminVerificationsPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell admin-shell">
        <AdminVerificationQueue />
      </div>
    </main>
  );
}
