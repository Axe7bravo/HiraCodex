import { Suspense } from "react";
import Link from "next/link";
import { Building2, ChevronDown, Globe2, Home } from "lucide-react";
import { PropertyDiscovery } from "./property-discovery";

export default function PropertiesPage() {
  return (
    <main className="discovery-page">
      <DiscoveryHeader />
      <Suspense fallback={<p className="discovery-state">Loading homes…</p>}>
        <PropertyDiscovery />
      </Suspense>
      <DiscoveryFooter />
    </main>
  );
}

function DiscoveryHeader() {
  return (
    <header className="marketplace-header">
      <div className="marketplace-header-inner">
        <Link className="marketplace-brand" href="/" aria-label="Hira home">
          Hira<span>.</span>
        </Link>
        <nav className="marketplace-nav" aria-label="Marketplace navigation">
          <Link className="marketplace-nav-active" href="/properties">
            Find Housing
          </Link>
          <Link href="/register">List Property</Link>
          <Link href="/">How it Works</Link>
          <Link className="marketplace-resources" href="/">
            Resources <ChevronDown aria-hidden="true" />
          </Link>
        </nav>
        <div className="marketplace-account-actions">
          <span className="locale-pill" aria-label="Locale Lesotho">
            <Globe2 aria-hidden="true" /> LS
          </span>
          <Link className="marketplace-sign-in" href="/login">
            Sign In
          </Link>
          <Link className="marketplace-list-property" href="/register">
            <Home aria-hidden="true" /> List Property
          </Link>
        </div>
      </div>
    </header>
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
