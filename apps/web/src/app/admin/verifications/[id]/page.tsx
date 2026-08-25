import { SiteHeader } from "@/components/site-header";
import { AdminVerificationReview } from "./verification-review";

export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell admin-shell">
        <AdminVerificationReview id={id} />
      </div>
    </main>
  );
}
