"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  CircleUserRound,
  FileQuestion,
  Heart,
  Home,
  LogOut,
  MapPin,
  MessageCircleMore,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  apiRequest,
  apiUrl,
  type AccommodationRequest,
  type FavouriteItem,
  type Inquiry,
  type UserProfile,
  type VerificationSubmission,
} from "@/lib/api";

type TenantProfile = Extract<UserProfile, { role: "TENANT" }>;

type TenantDashboardProps = {
  profile: TenantProfile;
  profileEditor: ReactNode;
  logout: () => Promise<void>;
  signingOut: boolean;
};

export function TenantDashboard({ profile, profileEditor, logout, signingOut }: TenantDashboardProps) {
  const [saved, setSaved] = useState<FavouriteItem[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [requests, setRequests] = useState<AccommodationRequest[]>([]);
  const [verification, setVerification] = useState<VerificationSubmission | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      apiRequest<FavouriteItem[]>("/favourites"),
      apiRequest<Inquiry[]>("/inquiries"),
      apiRequest<AccommodationRequest[]>("/requests"),
      apiRequest<VerificationSubmission>("/verifications/me"),
    ])
      .then(([savedItems, inquiryItems, requestItems, submission]) => {
        setSaved(savedItems);
        setInquiries(inquiryItems);
        setRequests(requestItems);
        setVerification(submission);
      })
      .catch((error: Error) => setSummaryError(error.message))
      .finally(() => setSummaryLoading(false));
  }, []);

  return (
    <div className="tenant-dashboard-shell">
      <aside className="tenant-dashboard-nav">
        <p>Tenant menu</p>
        <nav aria-label="Tenant account navigation">
          <Link className="active" href="/account"><Home aria-hidden="true" /> Overview</Link>
          <Link href="/account/favourites"><Heart aria-hidden="true" /> Saved properties</Link>
          <Link href="/account/inquiries"><MessageCircleMore aria-hidden="true" /> Inquiries</Link>
          <Link href="/account/requests"><FileQuestion aria-hidden="true" /> My requests</Link>
          <Link href="/account/verification"><ShieldCheck aria-hidden="true" /> Verification</Link>
          <Link href="#profile-settings"><CircleUserRound aria-hidden="true" /> Profile</Link>
        </nav>
        <Link className="tenant-nav-search" href="/properties">
          <Search aria-hidden="true" />
          <span><strong>Find your next room</strong><small>Browse approved properties</small></span>
        </Link>
        <button type="button" onClick={logout} disabled={signingOut}>
          <LogOut aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      <div className="tenant-dashboard-main">
        <header className="tenant-dashboard-heading">
          <div>
            <p>Welcome back, {profile.firstName}</p>
            <h1>Your housing overview</h1>
            <span>Keep track of the homes and landlord connections that matter to you.</span>
          </div>
          <Link href="/properties"><Search aria-hidden="true" /> Search properties</Link>
        </header>

        {summaryError && <p className="dashboard-summary-error" role="alert">Some account activity could not be loaded. {summaryError}</p>}

        <section className="tenant-summary-grid" aria-label="Account activity summary">
          <SummaryCard icon={<Heart />} label="Saved properties" value={summaryLoading ? "—" : String(saved.length)} href="/account/favourites" />
          <SummaryCard icon={<MessageCircleMore />} label="Inquiries" value={summaryLoading ? "—" : String(inquiries.length)} href="/account/inquiries" accent />
          <SummaryCard icon={<FileQuestion />} label="Requests" value={summaryLoading ? "—" : String(requests.length)} href="/account/requests" />
          <VerificationSummary status={profile.verificationStatus} />
        </section>

        <div className="tenant-dashboard-content">
          <section className="tenant-saved-preview" aria-labelledby="saved-preview-title">
            <div className="tenant-section-heading">
              <div><p>YOUR SHORTLIST</p><h2 id="saved-preview-title">Saved properties</h2></div>
              <Link href="/account/favourites">View all <ChevronRight aria-hidden="true" /></Link>
            </div>
            {summaryLoading ? (
              <div className="tenant-preview-loading">Loading saved properties…</div>
            ) : saved.length === 0 ? (
              <DashboardEmpty title="No saved properties yet" copy="Save homes you want to compare and revisit." href="/properties" action="Browse properties" />
            ) : (
              <div className="tenant-saved-grid">
                {saved.slice(0, 3).map(({ property }) => {
                  const photo = property.photos[0];
                  return (
                    <article key={property.id}>
                      <Link className="tenant-saved-image" href={`/properties/${property.id}`}>
                        {photo && !failedPhotos.includes(property.id) ? (
                          <Image fill unoptimized sizes="(max-width: 720px) 100vw, 28vw" src={`${apiUrl}/discovery/properties/${property.id}/photos/${photo.id}`} alt={`${property.title} listing`} onError={() => setFailedPhotos((current) => [...current, property.id])} />
                        ) : <span><Home aria-hidden="true" /> Image unavailable</span>}
                      </Link>
                      <div><h3><Link href={`/properties/${property.id}`}>{property.title}</Link></h3><p><MapPin aria-hidden="true" /> {property.area}, {property.city}</p><strong>M {Number(property.monthlyPrice).toLocaleString()} <small>/ month</small></strong></div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="tenant-activity-column">
            <VerificationPanel status={profile.verificationStatus} verification={verification} />
            <ActivityPanel title="Accommodation requests" href="/account/requests" empty={requests.length === 0} loading={summaryLoading}>
              {requests.slice(0, 3).map((request) => <ActivityRow key={request.id} title={request.property.title} status={request.status} />)}
            </ActivityPanel>
            <ActivityPanel title="Recent inquiries" href="/account/inquiries" empty={inquiries.length === 0} loading={summaryLoading}>
              {inquiries.slice(0, 3).map((inquiry) => <ActivityRow key={inquiry.id} title={inquiry.property.title} status={inquiry.status} />)}
            </ActivityPanel>
          </aside>
        </div>

        <section className="tenant-next-step">
          <div><BadgeCheck aria-hidden="true" /><div><p>Keep your Hira details current</p><h2>Make it easier to progress when you find the right room.</h2></div></div>
          <Link href="#profile-settings">Review profile <ChevronRight aria-hidden="true" /></Link>
        </section>

        <section className="tenant-profile-settings" id="profile-settings" aria-labelledby="profile-settings-title">
          <div className="tenant-section-heading"><div><p>ACCOUNT</p><h2 id="profile-settings-title">Profile details</h2></div></div>
          {profileEditor}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, href, accent = false }: { icon: ReactNode; label: string; value: string; href: string; accent?: boolean }) {
  return <article className={accent ? "tenant-summary-card accent" : "tenant-summary-card"}><span>{icon}</span><div><p>{label}</p><strong>{value}</strong><Link href={href}>View details</Link></div></article>;
}

function VerificationSummary({ status }: { status: TenantProfile["verificationStatus"] }) {
  return <article className={`tenant-summary-card verification ${status.toLowerCase()}`}><span><ShieldCheck /></span><div><p>Verification</p><strong>{verificationLabel(status)}</strong><Link href="/account/verification">View details</Link></div></article>;
}

function VerificationPanel({ status, verification }: { status: TenantProfile["verificationStatus"]; verification: VerificationSubmission | null }) {
  const content = verificationContent(status);
  return <section className={`tenant-verification-panel ${status.toLowerCase()}`}><ShieldCheck aria-hidden="true" /><div><p>Verification status</p><h2>{content.title}</h2><span>{status === "REJECTED" && verification?.rejectionReason ? verification.rejectionReason : content.copy}</span><Link href="/account/verification">{content.action}</Link></div></section>;
}

function ActivityPanel({ title, href, empty, loading, children }: { title: string; href: string; empty: boolean; loading: boolean; children: ReactNode }) {
  return <section className="tenant-activity-panel"><div><h2>{title}</h2><Link href={href}>View all</Link></div>{loading ? <p>Loading…</p> : empty ? <p>No activity yet. <Link href="/properties">Browse rooms</Link></p> : <div>{children}</div>}</section>;
}

function ActivityRow({ title, status }: { title: string; status: string }) {
  return <div className="tenant-activity-row"><span>{title}</span><strong>{status.replaceAll("_", " ")}</strong></div>;
}

function DashboardEmpty({ title, copy, href, action }: { title: string; copy: string; href: string; action: string }) {
  return <div className="tenant-dashboard-empty"><Heart aria-hidden="true" /><div><h3>{title}</h3><p>{copy}</p></div><Link href={href}>{action}</Link></div>;
}

function verificationLabel(status: TenantProfile["verificationStatus"]) {
  return { NOT_SUBMITTED: "Not submitted", PENDING: "Pending review", APPROVED: "Verified", REJECTED: "Action needed" }[status];
}

function verificationContent(status: TenantProfile["verificationStatus"]) {
  return {
    NOT_SUBMITTED: { title: "Complete student verification", copy: "Submit your student evidence for Hira review.", action: "Start verification" },
    PENDING: { title: "Review in progress", copy: "Your submission is waiting for an administrator’s decision.", action: "View submission" },
    APPROVED: { title: "Verified student", copy: "Your student verification has been approved.", action: "View verification" },
    REJECTED: { title: "Verification needs attention", copy: "Review the decision and submit updated evidence.", action: "Review and resubmit" },
  }[status];
}
