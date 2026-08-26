import { SiteHeader } from "@/components/site-header";
import { AdminPropertyReview } from "./property-review";

export default async function AdminPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell property-shell">
        <AdminPropertyReview id={id} />
      </div>
    </main>
  );
}
