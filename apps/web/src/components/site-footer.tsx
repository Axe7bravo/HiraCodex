import Link from "next/link";
import { MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <section className="site-footer-brand" aria-labelledby="footer-brand">
          <Link id="footer-brand" href="/" aria-label="Hira home">
            Hira<span>.</span>
          </Link>
          <p>Verified student housing made simpler.</p>
        </section>

        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore">Explore</h2>
          <Link href="/properties">Find housing</Link>
          <Link href="/register">Create account</Link>
          <Link href="/login">Sign in</Link>
        </nav>

        <nav aria-labelledby="footer-help-legal">
          <h2 id="footer-help-legal">Help &amp; legal</h2>
          <Link href="/faqs">FAQs</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <p>© 2026 Hira</p>
        <p>
          <MapPin aria-hidden="true" /> Built for student housing in Maseru,
          Lesotho
        </p>
      </div>
    </footer>
  );
}
