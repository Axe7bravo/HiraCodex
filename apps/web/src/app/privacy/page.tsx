import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Hira",
  description: "How Hira V1 handles marketplace and verification information.",
};

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Hira policies"
      title="Privacy Policy"
      intro="This policy describes the information Hira V1 uses to operate a trusted student-housing marketplace."
    >
      <p className="public-info-updated">Last updated: 29 August 2026</p>

      <section>
        <h2>1. Information Hira handles</h2>
        <p>Depending on how you use Hira, this may include:</p>
        <ul>
          <li>
            account and authentication information, including your name, email,
            password hash, role and account status;
          </li>
          <li>
            tenant or landlord profile details such as phone number, preferred
            contact method, institution, move-in date, organisation and
            landlord-declared portfolio count;
          </li>
          <li>student or landlord verification submissions and documents;</li>
          <li>property listing information and photographs;</li>
          <li>saved properties, inquiries and accommodation requests;</li>
          <li>
            email-notification records and administrative moderation or audit
            records;
          </li>
          <li>
            basic technical and operational information needed to secure,
            maintain and understand the service.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. How information is used</h2>
        <p>
          Hira uses information to authenticate accounts, maintain profiles,
          review verification submissions, publish approved listings, provide
          discovery and saved-property features, deliver inquiries and
          accommodation requests, send transactional emails, moderate the
          marketplace, protect users and diagnose service problems.
        </p>
      </section>

      <section>
        <h2>3. Marketplace visibility and sharing</h2>
        <p>
          Approved listing information and safe landlord summaries may be shown
          publicly. Information from inquiries and accommodation requests is
          shared only with the relevant participants and authorised Hira
          administrators as needed for the workflow. Service providers may
          process limited information to host the application, store files or
          deliver transactional email on Hira's behalf.
        </p>
        <p>Hira does not sell personal data.</p>
      </section>

      <section>
        <h2>4. Verification documents</h2>
        <p>
          Verification documents are private. They are stored through protected
          storage and are retrieved through authenticated, authorised access.
          They are not converted into permanent public links or included in
          public profiles and property listings.
        </p>
      </section>

      <section>
        <h2>5. Retention and deletion</h2>
        <p>
          Hira keeps information for as long as reasonably needed to operate
          V1, preserve marketplace and audit history, meet security needs and
          comply with applicable obligations. Retention and deletion may be
          handled manually; this policy does not promise automatic deletion on
          a fixed schedule.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          Hira uses measures appropriate to V1, including protected sessions,
          role and ownership checks, private document access and administrative
          audit records. No online service can guarantee absolute security, so
          users should also protect their passwords and devices.
        </p>
      </section>

      <section>
        <h2>7. Your choices</h2>
        <p>
          You can review and update supported profile information through your
          account. You may remove saved properties and use the available
          controls for your inquiries or requests. Some historical or audit
          information may need to remain where deletion would undermine safety,
          integrity or legal obligations.
        </p>
      </section>

      <section>
        <h2>8. Policy updates</h2>
        <p>
          Hira may revise this policy when its V1 data practices change. The
          current update date will remain visible on this page.
        </p>
      </section>
    </PublicPageShell>
  );
}
