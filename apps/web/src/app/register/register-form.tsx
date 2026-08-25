"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, SafeUser } from "@/lib/api";

type Role = "TENANT" | "LANDLORD";

export function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("TENANT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmPassword = String(form.get("confirmPassword"));
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest<SafeUser>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          firstName: String(form.get("firstName")).trim(),
          lastName: String(form.get("lastName")).trim(),
          email: String(form.get("email")).trim(),
          password,
          role,
        }),
      });
      router.push("/login?registered=1");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Registration failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="field-row">
        <label>
          First name
          <input
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={80}
          />
        </label>
        <label>
          Last name
          <input
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={80}
          />
        </label>
      </div>
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
        <small>Use at least 8 characters.</small>
      </label>
      <label>
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>

      <fieldset className="role-picker">
        <legend>I want to use Hira as</legend>
        <label
          className={role === "TENANT" ? "role-option selected" : "role-option"}
        >
          <input
            type="radio"
            name="role"
            value="TENANT"
            checked={role === "TENANT"}
            onChange={() => setRole("TENANT")}
          />
          <span className="role-icon" aria-hidden="true">
            ⌂
          </span>
          <strong>Student / Tenant</strong>
          <small>Find trusted student housing</small>
        </label>
        <label
          className={
            role === "LANDLORD" ? "role-option selected" : "role-option"
          }
        >
          <input
            type="radio"
            name="role"
            value="LANDLORD"
            checked={role === "LANDLORD"}
            onChange={() => setRole("LANDLORD")}
          />
          <span className="role-icon" aria-hidden="true">
            ▤
          </span>
          <strong>Landlord</strong>
          <small>List and manage properties</small>
        </label>
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="form-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
