import { SiteHeader } from "@/components/site-header";
import { PropertyList } from "./property-list";

export default function PropertiesPage() {
  return (
    <main className="auth-page">
      <SiteHeader />
      <div className="account-shell property-shell">
        <PropertyList />
      </div>
    </main>
  );
}
