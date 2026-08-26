import { SiteHeader } from "@/components/site-header";
import { PropertyForm } from "../property-form";

export default function NewPropertyPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell property-shell">
        <PropertyForm />
      </div>
    </main>
  );
}
