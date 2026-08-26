import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { PropertyDiscovery } from "./property-discovery";

export default function PropertiesPage() {
  return (
    <main className="discovery-page">
      <SiteHeader />
      <Suspense fallback={<p className="discovery-state">Loading homes…</p>}>
        <PropertyDiscovery />
      </Suspense>
    </main>
  );
}
