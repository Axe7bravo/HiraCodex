"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CircleUserRound, FileQuestion, MessageCircleMore, ShieldCheck } from "lucide-react";
import { SiteHeader } from "./site-header";
import { apiRequest, type UserProfile } from "@/lib/api";

type LandlordContextRole = "LANDLORD" | "ADMIN";

export function LandlordShell({ children, role: suppliedRole }: { children: ReactNode; role?: LandlordContextRole }) {
  const [role, setRole] = useState<LandlordContextRole | null>(suppliedRole ?? null);
  useEffect(() => {
    if (suppliedRole) return;
    apiRequest<UserProfile>("/users/me").then((profile) => {
      if (profile.role === "ADMIN" || profile.role === "LANDLORD") setRole(profile.role);
    }).catch(() => undefined);
  }, [suppliedRole]);
  return <main className="account-overview-page landlord-area"><SiteHeader /><div className="account-overview-shell"><LandlordWorkspace role={role}>{children}</LandlordWorkspace></div></main>;
}

export function LandlordWorkspace({ children, role }: { children: ReactNode; role: LandlordContextRole | null }) {
  const pathname = usePathname();
  return (
    <div className="landlord-workspace-shell">
      <aside className="landlord-workspace-nav">
        <p>Landlord workspace</p>
        <nav aria-label="Landlord workspace navigation">
          <WorkspaceLink href="/account/properties" active={pathname.startsWith("/account/properties")}><Building2 aria-hidden="true" /> My properties</WorkspaceLink>
          <WorkspaceLink href="/account/inquiries" active={pathname.startsWith("/account/inquiries")}><MessageCircleMore aria-hidden="true" /> Inquiries</WorkspaceLink>
          <WorkspaceLink href="/account/requests" active={pathname.startsWith("/account/requests")}><FileQuestion aria-hidden="true" /> Requests</WorkspaceLink>
          {role === "LANDLORD" && <WorkspaceLink href="/account/verification" active={pathname.startsWith("/account/verification")}><ShieldCheck aria-hidden="true" /> Verification</WorkspaceLink>}
          {role === "LANDLORD" && <WorkspaceLink href="/account" active={pathname === "/account"}><CircleUserRound aria-hidden="true" /> Profile</WorkspaceLink>}
        </nav>
        {role === "ADMIN" && <div className="landlord-trusted-admin"><ShieldCheck aria-hidden="true" /><div><strong>Internal trusted owner</strong><span>Landlord verification is not required for this admin account.</span></div></div>}
      </aside>
      <div className="landlord-workspace-content">{children}</div>
    </div>
  );
}

function WorkspaceLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link className={active ? "active" : undefined} href={href} aria-current={active ? "page" : undefined}>{children}</Link>;
}
