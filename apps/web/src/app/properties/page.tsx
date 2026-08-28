import { Suspense } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PropertyDiscovery } from "./property-discovery";

export default function PropertiesPage() {
  return (
    <main className="discovery-page">
      <SiteHeader />
      <Suspense fallback={<p className="discovery-state">Loading homes…</p>}>
        <PropertyDiscovery />
      </Suspense>
      <DiscoveryFooter />
    </main>
  );
}

function DiscoveryFooter() {
  return (
    <footer className="marketplace-footer">
      <div className="marketplace-footer-inner">
        <div>
          <Link className="marketplace-brand marketplace-footer-brand" href="/">
            Hira<span>.</span>
          </Link>
          <p>Verified student housing in Maseru.</p>
        </div>
        <nav aria-label="Footer marketplace links">
          <strong>Platform</strong>
          <Link href="/properties">Find Housing</Link>
          <Link href="/register">List Property</Link>
        </nav>
        <nav aria-label="Footer account links">
          <strong>Account</strong>
          <Link href="/login">Sign In</Link>
          <Link href="/register">Create Account</Link>
        </nav>
        <div className="marketplace-footer-local">
          <Building2 aria-hidden="true" />
          <span>Proudly based in Lesotho</span>
        </div>
      </div>
    </footer>
  );
}
