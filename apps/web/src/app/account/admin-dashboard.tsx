"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { AdminWorkspace } from "@/components/admin-shell";
import {
  apiRequest,
  type AdminPropertyQueueItem,
  type AdminVerificationQueueItem,
  type UserProfile,
} from "@/lib/api";

type AdminProfile = Extract<UserProfile, { role: "ADMIN" }>;

export function AdminDashboard({ profile, profileEditor }: {
  profile: AdminProfile;
  profileEditor: ReactNode;
}) {
  const [verifications, setVerifications] = useState<AdminVerificationQueueItem[]>([]);
  const [properties, setProperties] = useState<AdminPropertyQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<AdminVerificationQueueItem[]>("/admin/verifications"),
      apiRequest<AdminPropertyQueueItem[]>("/admin/properties"),
    ])
      .then(([verificationQueue, propertyQueue]) => {
        setVerifications(verificationQueue);
        setProperties(propertyQueue);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const studentQueue = verifications.filter((item) => item.type === "STUDENT");
  const landlordQueue = verifications.filter((item) => item.type === "LANDLORD");

  return (
    <AdminWorkspace>
      <div className="admin-dashboard-main">
        <header className="admin-dashboard-heading">
          <div><p>Hira operations</p><h1>Review overview</h1><span>Welcome, {profile.firstName}. Prioritise the submissions waiting for a decision.</span></div>
        </header>

        {error && <p className="admin-overview-error" role="alert">Pending work could not be loaded. {error}</p>}

        <section className="admin-priority-grid" aria-label="Pending review counts">
          <AdminMetric icon={<GraduationCap />} label="Student verifications" value={loading ? "—" : String(studentQueue.length)} href="/admin/verifications?type=STUDENT" />
          <AdminMetric icon={<BadgeCheck />} label="Landlord verifications" value={loading ? "—" : String(landlordQueue.length)} href="/admin/verifications?type=LANDLORD" accent />
          <AdminMetric icon={<Building2 />} label="Property reviews" value={loading ? "—" : String(properties.length)} href="/admin/properties" />
        </section>

        <div className="admin-overview-grid">
          <QueuePanel title="Verification queue" description="Student and landlord submissions awaiting review." href="/admin/verifications" loading={loading} empty={verifications.length === 0} emptyCopy="Verification queues are clear.">
            {verifications.slice(0, 5).map((item) => (
              <li key={item.id}><span className={item.type === "STUDENT" ? "student" : "landlord"}>{item.type === "STUDENT" ? "Student" : "Landlord"}</span><div><strong>{item.user.firstName} {item.user.lastName}</strong><small>{queueContext(item)} · {item.documentCount} document{item.documentCount === 1 ? "" : "s"}</small></div><Link href={`/admin/verifications/${item.id}`}>Review <ChevronRight aria-hidden="true" /></Link></li>
            ))}
          </QueuePanel>

          <QueuePanel title="Property moderation" description="Listings submitted for approval, oldest first." href="/admin/properties" loading={loading} empty={properties.length === 0} emptyCopy="Property review queue is clear.">
            {properties.slice(0, 5).map((item) => (
              <li key={item.id}><span className="property"><Building2 aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.area}, {item.city} · {item.photoCount} photos</small></div><Link href={`/admin/properties/${item.id}`}>Review <ChevronRight aria-hidden="true" /></Link></li>
            ))}
          </QueuePanel>
        </div>

        <section className="admin-next-actions" aria-labelledby="admin-actions-title">
          <div><ClipboardCheck aria-hidden="true" /><div><p>Operational priority</p><h2 id="admin-actions-title">Resolve pending reviews before passive monitoring.</h2></div></div>
          <div><Link href="/admin/verifications">Open verifications</Link><Link href="/admin/properties">Open properties</Link></div>
        </section>

        <section className="admin-profile-panel" id="admin-profile" aria-labelledby="admin-profile-title">
          <div><p>Account</p><h2 id="admin-profile-title">Admin profile</h2></div>
          {profileEditor}
        </section>
      </div>
    </AdminWorkspace>
  );
}

function AdminMetric({ icon, label, value, href, accent = false }: { icon: ReactNode; label: string; value: string; href: string; accent?: boolean }) {
  return <article className={accent ? "admin-metric accent" : "admin-metric"}><span>{icon}</span><div><p>{label}</p><strong>{value}</strong><Link href={href}>Open queue</Link></div></article>;
}

function QueuePanel({ title, description, href, loading, empty, emptyCopy, children }: { title: string; description: string; href: string; loading: boolean; empty: boolean; emptyCopy: string; children: ReactNode }) {
  return <section className="admin-queue-panel"><header><div><h2>{title}</h2><p>{description}</p></div><Link href={href}>View all <ChevronRight aria-hidden="true" /></Link></header>{loading ? <p className="admin-queue-state">Loading queue…</p> : empty ? <div className="admin-queue-empty"><ShieldCheck aria-hidden="true" /><p>{emptyCopy}</p></div> : <ul>{children}</ul>}</section>;
}

function queueContext(item: AdminVerificationQueueItem) {
  return item.type === "STUDENT"
    ? item.user.tenantProfile?.institution || "Institution not provided"
    : item.user.landlordProfile?.organisation || "Organisation not provided";
}
