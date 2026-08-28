"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CircleUserRound, Home, ShieldCheck } from "lucide-react";
import { SiteHeader } from "./site-header";

export function AdminShell({ children }: { children: ReactNode }) {
  return <main className="admin-area"><SiteHeader /><AdminWorkspace>{children}</AdminWorkspace></main>;
}

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="admin-dashboard-shell">
      <aside className="admin-dashboard-nav">
        <p>Admin operations</p>
        <nav aria-label="Admin navigation">
          <AdminLink href="/account" active={pathname === "/account"}><Home aria-hidden="true" /> Overview</AdminLink>
          <AdminLink href="/admin/verifications" active={pathname.startsWith("/admin/verifications")}><ShieldCheck aria-hidden="true" /> Verifications</AdminLink>
          <AdminLink href="/admin/properties" active={pathname.startsWith("/admin/properties")}><Building2 aria-hidden="true" /> Property reviews</AdminLink>
          <AdminLink href="/account#admin-profile" active={false}><CircleUserRound aria-hidden="true" /> Account</AdminLink>
        </nav>
      </aside>
      <div className="admin-workspace-content">{children}</div>
    </div>
  );
}

function AdminLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link className={active ? "active" : undefined} href={href} aria-current={active ? "page" : undefined}>{children}</Link>;
}

export function AdminStatus({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return <span className={`admin-status admin-status-${normalized}`}>{status.replaceAll("_", " ")}</span>;
}
