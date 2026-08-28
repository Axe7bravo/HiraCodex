"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest, type UserProfile } from "@/lib/api";

export function SiteHeader() {
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

  const authenticatedTenant =
    session !== "loading" && session !== "guest" && session.role === "TENANT";
  const inAccount = pathname.startsWith("/account");

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Hira home">
        Hira<span>.</span>
      </Link>
      <nav aria-label="Account navigation">
        <Link href="/properties">Find housing</Link>
        {authenticatedTenant ? (
          <>
            <Link
              className={inAccount ? "site-header-current" : undefined}
              href="/account"
              aria-current={inAccount ? "page" : undefined}
            >
              My account
            </Link>
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
