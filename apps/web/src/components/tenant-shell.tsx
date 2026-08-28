"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, FileQuestion, Heart, Home, MessageCircleMore, Search, ShieldCheck } from "lucide-react";
import { SiteHeader } from "./site-header";

export function TenantShell({ children }: { children: ReactNode }) {
  return <main className="account-overview-page"><SiteHeader /><div className="account-overview-shell"><TenantWorkspace>{children}</TenantWorkspace></div></main>;
}

export function TenantWorkspace({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="tenant-dashboard-shell">
      <aside className="tenant-dashboard-nav">
        <p>Tenant menu</p>
        <nav aria-label="Tenant account navigation">
          <TenantLink href="/account" active={pathname === "/account"}><Home aria-hidden="true" /> Overview</TenantLink>
          <TenantLink href="/account/favourites" active={pathname.startsWith("/account/favourites")}><Heart aria-hidden="true" /> Saved properties</TenantLink>
          <TenantLink href="/account/inquiries" active={pathname.startsWith("/account/inquiries")}><MessageCircleMore aria-hidden="true" /> Inquiries</TenantLink>
          <TenantLink href="/account/requests" active={pathname.startsWith("/account/requests")}><FileQuestion aria-hidden="true" /> My requests</TenantLink>
          <TenantLink href="/account/verification" active={pathname.startsWith("/account/verification")}><ShieldCheck aria-hidden="true" /> Verification</TenantLink>
          <TenantLink href="/account#profile-settings" active={false}><CircleUserRound aria-hidden="true" /> Profile</TenantLink>
        </nav>
        <Link className="tenant-nav-search" href="/properties"><Search aria-hidden="true" /><span><strong>Find your next room</strong><small>Browse approved properties</small></span></Link>
        {footer}
      </aside>
      <div className="tenant-workspace-content">{children}</div>
    </div>
  );
}

function TenantLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link className={active ? "active" : undefined} href={href} aria-current={active ? "page" : undefined}>{children}</Link>;
}

export function TenantStatus({ status }: { status: string }) {
  return <span className={`tenant-status tenant-status-${status.toLowerCase()}`}>{status.replaceAll("_", " ")}</span>;
}

export function TenantEmpty({ title, copy, href = "/properties", action = "Browse properties" }: { title: string; copy: string; href?: string; action?: string }) {
  return <div className="tenant-page-state tenant-empty-state"><Home aria-hidden="true" /><h2>{title}</h2><p>{copy}</p><Link className="button button-outline" href={href}>{action}</Link></div>;
}
