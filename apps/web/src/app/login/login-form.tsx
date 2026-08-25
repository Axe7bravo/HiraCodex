"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, SafeUser } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const registered = useSearchParams().get("registered") === "1";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest<SafeUser>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(form.get("email")).trim(),
          password: String(form.get("password")),
        }),
      });
      router.replace("/account");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Sign in failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {registered && (
        <p className="form-success" role="status">
          Account created. Sign in to continue.
        </p>
      )}
      <label>
        Email address
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="form-switch">
        New to Hira? <Link href="/register">Create an account</Link>
      </p>
    </form>
  );
}
