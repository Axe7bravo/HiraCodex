import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PropertyDiscovery } from "./property-discovery";

export default function PropertiesPage() {
  return (
    <div className="discovery-page">
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="discovery-state">Loading homes…</p>}>
          <PropertyDiscovery />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
