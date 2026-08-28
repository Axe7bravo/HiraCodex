import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public-page-shell";

export const metadata: Metadata = {
  title: "FAQs | Hira",
  description: "Answers about finding and listing student housing with Hira V1.",
};

const faqs = [
  {
    question: "What is Hira?",
    answer:
      "Hira is a student-housing marketplace for Maseru. It helps accommodation seekers discover approved listings and connect with landlords through structured inquiries and accommodation requests.",
  },
  {
    question: "Who can use Hira?",
    answer:
      "People can browse ACTIVE listings publicly. Registered tenants can save properties and contact landlords, registered landlords can manage their own listings and responses, and administrators review verification and listing submissions.",
  },
  {
    question: "Is Hira only for students?",
    answer:
      "Hira V1 is designed primarily for tertiary students. Young professionals may also browse the marketplace, but the product and verification experience prioritize student housing needs.",
  },
  {
    question: "How does student verification work?",
    answer:
      "A tenant can submit supported evidence of student status. The submission stays PENDING until an authorised Hira administrator approves or rejects it. A rejected submission may include a review note and can be resubmitted.",
  },
  {
    question: "How are landlords verified?",
    answer:
      "A landlord submits supported identity evidence for private administrative review. Verification documents are not displayed publicly. Verification is a trust measure, not a guarantee about every future interaction or property.",
  },
  {
    question: "Are listings reviewed before appearing publicly?",
    answer:
      "Yes. A listing is created as DRAFT and submitted as PENDING_REVIEW. Only an approved ACTIVE listing appears in public discovery. A listing may instead be REJECTED, PAUSED or made INACTIVE.",
  },
  {
    question: "How do I find accommodation?",
    answer:
      "Open Find housing to browse ACTIVE listings. You can filter authoritative marketplace results by price, area, nearest institution, availability, room type and amenities, then open a property to review its details.",
  },
  {
    question: "Can I save properties?",
    answer:
      "Yes. An authenticated tenant can save or remove ACTIVE properties and view saved properties from their account. A property that later becomes unavailable may be omitted or labelled safely.",
  },
  {
    question: "What is an inquiry?",
    answer:
      "An inquiry is a tenant's structured message of interest about an ACTIVE property. It can include an optional move-in date. The owning landlord can mark it RESPONDED or CLOSED and continue follow-up through the available contact details.",
  },
  {
    question: "What is an accommodation request?",
    answer:
      "It is a structured request for an ACTIVE property with a preferred move-in date and optional note. Its V1 statuses are PENDING, ACCEPTED, DECLINED and CANCELLED.",
  },
  {
    question: "What happens after a landlord accepts my request?",
    answer:
      "ACCEPTED records a positive marketplace response. It does not mean a completed booking, tenancy, signed lease or payment. The tenant and landlord continue the viewing, contact and placement process outside Hira.",
  },
  {
    question: "Does Hira handle rent or deposits?",
    answer:
      "No. Hira V1 does not process rent, deposits or marketplace payments. Any proposed off-platform payment should be assessed carefully and agreed directly between the relevant parties.",
  },
  {
    question: "Can landlords edit an active listing?",
    answer:
      "An ACTIVE listing must first be paused. The landlord can then edit it and submit it for review again before it becomes publicly discoverable as ACTIVE.",
  },
  {
    question: "Why was a listing paused or removed?",
    answer:
      "A landlord may pause their own listing, or an administrator may moderate a listing because of availability, accuracy, policy, safety or suspected abuse concerns. Only ACTIVE listings appear publicly.",
  },
  {
    question: "What happens to my verification documents?",
    answer:
      "They remain private and are available only through protected, authorised access for the relevant verification workflow. Hira does not turn them into permanent public links or show them on public profiles.",
  },
  {
    question: "How do I report or resolve a problem?",
    answer:
      "Hira V1 does not yet provide a public in-app reporting workflow or a published support address. If something appears unsafe or inaccurate, do not proceed with the accommodation arrangement. Preserve relevant details and use an official support channel only when Hira publishes one in the application.",
  },
] as const;

export default function FaqsPage() {
  return (
    <PublicPageShell
      eyebrow="Help centre"
      title="Frequently asked questions"
      intro="Straightforward answers about finding, listing and requesting student accommodation with Hira V1."
    >
      <div className="faq-list">
        {faqs.map(({ question, answer }) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </PublicPageShell>
  );
}
