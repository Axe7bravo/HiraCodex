import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public-page-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions | Hira",
  description: "Terms for using the Hira V1 student-housing marketplace.",
};

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Hira policies"
      title="Terms & Conditions"
      intro="These terms explain the practical rules for using Hira's V1 student-housing marketplace."
    >
      <p className="public-info-updated">Last updated: 29 August 2026</p>

      <section>
        <h2>1. About Hira</h2>
        <p>
          Hira is a marketplace that helps accommodation seekers discover
          student housing in Maseru and connect with landlords. Hira provides
          listing, verification, inquiry and accommodation-request tools. It is
          not a landlord, tenant, letting agent, payment provider, insurer or
          party to any tenancy agreement.
        </p>
      </section>

      <section>
        <h2>2. Accounts and eligibility</h2>
        <p>
          You must provide accurate account information, use the role that
          reflects how you use Hira, and keep your password and account access
          secure. You are responsible for activity performed through your
          account. Public administrator registration is not available.
        </p>
      </section>

      <section>
        <h2>3. Tenant responsibilities</h2>
        <p>
          Tenants must provide truthful profile, verification, inquiry and
          accommodation-request information. Before making an off-platform
          commitment, tenants should independently assess the property,
          landlord, proposed terms and suitability of the accommodation.
        </p>
      </section>

      <section>
        <h2>4. Landlord and listing responsibilities</h2>
        <p>
          Landlords must have authority to advertise their accommodation and
          keep listing descriptions, prices, availability, photos, amenities
          and location information accurate. Listings may be reviewed before
          publication and may be paused, rejected or removed when they are
          inaccurate, inappropriate or breach these terms.
        </p>
      </section>

      <section>
        <h2>5. Verification and moderation</h2>
        <p>
          Hira may request documents and manually review users or listings.
          Verification and listing approval are trust and moderation measures;
          they are not guarantees of identity, ownership, availability,
          legality, quality, safety or suitability. Administrative decisions
          may be recorded in an audit log.
        </p>
      </section>

      <section>
        <h2>6. Inquiries and accommodation requests</h2>
        <p>
          An inquiry expresses interest. An accepted accommodation request is
          a marketplace workflow status only: it is not a booking, lease,
          signed contract or payment confirmation. Tenants and landlords must
          agree viewings, contact arrangements and any tenancy terms outside
          Hira.
        </p>
      </section>

      <section>
        <h2>7. Payments and agreements</h2>
        <p>
          Hira V1 does not collect or process rent, deposits or marketplace
          payments. Hira does not prepare or sign leases for users and does not
          guarantee that accommodation remains available.
        </p>
      </section>

      <section>
        <h2>8. Acceptable use</h2>
        <p>You must not use Hira to:</p>
        <ul>
          <li>misrepresent a person, property or accommodation opportunity;</li>
          <li>upload unlawful, fraudulent, harmful or infringing content;</li>
          <li>harass users or misuse contact and verification information;</li>
          <li>attempt to access another user's private account or documents;</li>
          <li>interfere with the security or operation of the service.</li>
        </ul>
      </section>

      <section>
        <h2>9. Account and content action</h2>
        <p>
          Hira may reject, pause or remove content and may suspend access where
          reasonably needed to protect users, operate the marketplace or
          address suspected fraud, abuse or policy breaches. Status-changing
          administrative actions are recorded where required by V1.
        </p>
      </section>

      <section>
        <h2>10. Service availability and Hira's role</h2>
        <p>
          Hira aims to keep the service useful and available, but uninterrupted
          or error-free access is not guaranteed. To the extent permitted by
          applicable law, users remain responsible for their decisions and
          off-platform arrangements. Nothing in these terms removes rights or
          obligations that cannot lawfully be excluded.
        </p>
      </section>

      <section>
        <h2>11. Changes to these terms</h2>
        <p>
          Hira may update these terms as the V1 service changes. The updated
          date will be shown on this page. Continued use after an update means
          the revised terms apply, subject to applicable law.
        </p>
      </section>

      <aside className="public-info-note">
        This is a practical V1 product draft and does not substitute for
        professional legal advice.
      </aside>
    </PublicPageShell>
  );
}
