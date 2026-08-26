import { SiteHeader } from "@/components/site-header";
import { PropertyForm } from "../../property-form";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell property-shell">
        <PropertyForm propertyId={id} />
      </div>
    </main>
  );
}
