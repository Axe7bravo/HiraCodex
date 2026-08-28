"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest, type UserProfile } from "@/lib/api";

export function SiteHeader({ landlordContext = false }: { landlordContext?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<
    "loading" | "guest" | UserProfile
  >("loading");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let current = true;
    apiRequest<UserProfile>("/users/me")
      .then((profile) => {
        if (current) setSession(profile);
      })
      .catch(() => {
        if (current) setSession("guest");
      });
    return () => {
      current = false;
    };
  }, []);

  async function logout() {
    setSigningOut(true);
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
      setSession("guest");
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const authenticatedProfile =
    session !== "loading" && session !== "guest" ? session : null;
  const inAccount = pathname.startsWith("/account");
  const inAdmin = pathname.startsWith("/admin");
  const inLandlordWorkspace =
    (pathname === "/account" && landlordContext) ||
    pathname.startsWith("/account/properties") ||
    pathname.startsWith("/account/inquiries") ||
    pathname.startsWith("/account/requests");
  const inPropertyDiscovery = pathname.startsWith("/properties");
  const accountLabel =
    authenticatedProfile?.role === "ADMIN"
      ? "Admin dashboard"
      : authenticatedProfile?.role === "LANDLORD"
        ? "Landlord account"
        : "My account";
  const inAdminArea =
    authenticatedProfile?.role === "ADMIN" &&
    (inAdmin || (pathname === "/account" && !inLandlordWorkspace));

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Hira home">
        Hira<span>.</span>
      </Link>
      <nav className={authenticatedProfile?.role === "ADMIN" ? "site-header-admin-nav" : undefined} aria-label="Account navigation">
        <Link
          className={inPropertyDiscovery ? "site-header-current" : undefined}
          href="/properties"
          aria-current={inPropertyDiscovery ? "page" : undefined}
        >
          Find housing
        </Link>
        {authenticatedProfile ? (
          <>
            {authenticatedProfile.role === "ADMIN" ? (
              <>
                <Link className={inAdminArea ? "site-header-current" : undefined} href="/account" aria-current={inAdminArea ? "page" : undefined}>Admin dashboard</Link>
                <Link className={inLandlordWorkspace ? "site-header-current" : undefined} href="/account?context=landlord" aria-current={inLandlordWorkspace ? "page" : undefined}>Landlord workspace</Link>
              </>
            ) : (
              <Link className={inAccount ? "site-header-current" : undefined} href="/account" aria-current={inAccount ? "page" : undefined}>{accountLabel}</Link>
            )}
            <button
              className="site-header-signout"
              type="button"
              onClick={logout}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : session === "loading" ? null : (
          <>
            <Link href="/login">Sign in</Link>
            <Link className="button button-small" href="/register">
              Create account
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
