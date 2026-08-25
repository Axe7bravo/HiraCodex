"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest, SafeUser } from "@/lib/api";

export function AccountClient() {
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<SafeUser>("/users/me")
      .then(setUser)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    setLoading(true);
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logout failed.");
      setLoading(false);
    }
  }

  if (loading) return <p className="account-state">Loading your account…</p>;
  if (error || !user)
    return (
      <div className="account-state">
        <p role="alert">{error || "You are not signed in."}</p>
        <Link className="button" href="/login">
          Sign in
        </Link>
      </div>
    );

  return (
    <section className="account-card">
      <p className="eyebrow">Authenticated session</p>
      <h1>Hello, {user.firstName}</h1>
      <p>
        This simple account state proves <code>GET /users/me</code> returned
        authoritative database data.
      </p>
      <dl>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{user.role === "TENANT" ? "Student / Tenant" : user.role}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{user.status}</dd>
        </div>
      </dl>
      <button
        className="button button-outline"
        type="button"
        onClick={logout}
        disabled={loading}
      >
        Sign out
      </button>
    </section>
  );
}
