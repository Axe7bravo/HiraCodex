"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Building2, ChevronRight, FileQuestion, MessageCircleMore, Plus, ShieldCheck } from "lucide-react";
import { LandlordStatus, LandlordWorkspace } from "@/components/landlord-shell";
import { apiRequest, type AccommodationRequest, type Inquiry, type LandlordProperty, type UserProfile } from "@/lib/api";

type LandlordContextProfile =
  | Extract<UserProfile, { role: "LANDLORD" }>
  | Extract<UserProfile, { role: "ADMIN" }>;

export function LandlordDashboard({ profile, profileEditor }: { profile: LandlordContextProfile; profileEditor: ReactNode }) {
  const [properties, setProperties] = useState<LandlordProperty[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [requests, setRequests] = useState<AccommodationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      apiRequest<LandlordProperty[]>("/properties/mine"),
      apiRequest<Inquiry[]>("/inquiries"),
      apiRequest<AccommodationRequest[]>("/requests"),
    ]).then(([owned, receivedInquiries, receivedRequests]) => {
      setProperties(owned);
      setInquiries(receivedInquiries);
      setRequests(receivedRequests);
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);
  const attention = properties.filter(({ status }) => status === "DRAFT" || status === "REJECTED");
  const pendingRequests = requests.filter(({ status }) => status === "PENDING");
  const openInquiries = inquiries.filter(({ status }) => status === "OPEN");

  return <LandlordWorkspace role={profile.role}>
    <div className="landlord-dashboard-main">
      <header className="landlord-page-heading landlord-dashboard-heading"><div><p className="eyebrow">Landlord workspace</p><h1>Welcome, {profile.firstName}</h1><span>Manage your listings and respond to student interest.</span></div><Link className="button" href="/account/properties/new"><Plus aria-hidden="true" /> Create listing</Link></header>
      {error && <p className="landlord-state state-failure" role="alert">Some workspace activity could not be loaded. {error}</p>}
      <section className="landlord-summary-grid" aria-label="Landlord activity summary">
        <Summary label="My properties" value={loading ? "—" : String(properties.length)} href="/account/properties" icon={<Building2 />} />
        <Summary label="Open inquiries" value={loading ? "—" : String(openInquiries.length)} href="/account/inquiries" icon={<MessageCircleMore />} accent />
        <Summary label="Pending requests" value={loading ? "—" : String(pendingRequests.length)} href="/account/requests" icon={<FileQuestion />} />
        <Summary label="Needs attention" value={loading ? "—" : String(attention.length)} href="/account/properties" icon={<ShieldCheck />} />
      </section>
      <div className="landlord-overview-grid">
        <OverviewPanel title="Listings" href="/account/properties" loading={loading} empty={properties.length === 0} emptyText="List your first property on Hira.">
          {properties.slice(0, 4).map((property) => <article key={property.id}><div><strong>{property.title}</strong><span>{property.area} · M {Number(property.monthlyPrice).toLocaleString()} / month</span></div><LandlordStatus status={property.status} /></article>)}
        </OverviewPanel>
        <div className="landlord-activity-stack">
          <OverviewPanel title="Recent inquiries" href="/account/inquiries" loading={loading} empty={inquiries.length === 0} emptyText="No tenant inquiries yet.">{inquiries.slice(0, 3).map((item) => <article key={item.id}><div><strong>{item.property.title}</strong><span>{item.tenant ? `${item.tenant.firstName} ${item.tenant.lastName}` : "Tenant inquiry"}</span></div><LandlordStatus status={item.status} /></article>)}</OverviewPanel>
          <OverviewPanel title="Accommodation requests" href="/account/requests" loading={loading} empty={requests.length === 0} emptyText="No accommodation requests yet.">{requests.slice(0, 3).map((item) => <article key={item.id}><div><strong>{item.property.title}</strong><span>Move-in {item.preferredMoveInDate.slice(0, 10)}</span></div><LandlordStatus status={item.status} /></article>)}</OverviewPanel>
        </div>
      </div>
      <section className="landlord-trust-panel"><ShieldCheck aria-hidden="true" /><div><p>Trust status</p><h2>{profile.role === "ADMIN" ? "Verification not required for Hira admin accounts" : verificationTitle(profile.verificationStatus)}</h2><span>{profile.role === "ADMIN" ? "This internally trusted account may submit its own listings for review." : verificationCopy(profile.verificationStatus)}</span></div>{profile.role === "LANDLORD" && <Link href="/account/verification">Manage verification</Link>}</section>
      <section className="landlord-profile-panel" id="landlord-profile"><div><p className="eyebrow">Account</p><h2>Profile details</h2></div>{profileEditor}</section>
    </div>
  </LandlordWorkspace>;
}

function Summary({ label, value, href, icon, accent = false }: { label: string; value: string; href: string; icon: ReactNode; accent?: boolean }) {
  return <article className={accent ? "landlord-summary-card accent" : "landlord-summary-card"}><span>{icon}</span><div><p>{label}</p><strong>{value}</strong><Link href={href}>View details</Link></div></article>;
}

function OverviewPanel({ title, href, loading, empty, emptyText, children }: { title: string; href: string; loading: boolean; empty: boolean; emptyText: string; children: ReactNode }) {
  return <section className="landlord-overview-panel"><header><h2>{title}</h2><Link href={href}>View all <ChevronRight aria-hidden="true" /></Link></header>{loading ? <p className="landlord-panel-state">Loading…</p> : empty ? <div className="landlord-panel-empty"><p>{emptyText}</p><Link href={href}>Get started</Link></div> : <div className="landlord-overview-rows">{children}</div>}</section>;
}

function verificationTitle(status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED") {
  return { NOT_SUBMITTED: "Complete landlord verification", PENDING: "Verification review in progress", APPROVED: "Verified landlord", REJECTED: "Verification needs attention" }[status];
}
function verificationCopy(status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED") {
  return { NOT_SUBMITTED: "Upload your landlord evidence before submitting a listing for review.", PENDING: "Hira is reviewing your submitted evidence.", APPROVED: "Your landlord identity has been approved.", REJECTED: "Review the decision and submit updated evidence." }[status];
}
