"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword"));
    const confirmation = String(form.get("confirmPassword"));

    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("Password must be between 8 and 128 characters.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setComplete(true);
    } catch {
      setError(
        "This password reset link is invalid or has expired. Request a new link and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-result">
        <p className="form-error" role="alert">
          This password reset link is missing or invalid.
        </p>
        <Link className="button button-outline" href="/forgot-password">
          Request a new link
        </Link>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="auth-result">
        <p className="form-success" role="status">
          Your password has been reset. You can now sign in with your new
          password.
        </p>
        <Link className="button" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        New password
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
        <small>Use between 8 and 128 characters.</small>
      </label>
      <label>
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Resetting password…" : "Reset password"}
      </button>
    </form>
  );
}
