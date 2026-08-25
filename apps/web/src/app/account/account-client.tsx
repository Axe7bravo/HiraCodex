"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, UserProfile } from "@/lib/api";

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  contactMethod: string;
  institution: string;
  expectedMoveIn: string;
  organisation: string;
  propertyCount: string;
};

export function AccountClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    apiRequest<UserProfile>("/users/me")
      .then((loaded) => {
        setProfile(loaded);
        setForm(toForm(loaded));
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, []);

  function setField(field: keyof ProfileForm, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !form) return;
    setSaveError("");
    setSaved(false);
    setSaving(true);

    const body: Record<string, string | number | null> = {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: nullable(form.phone),
      contactMethod: nullable(form.contactMethod),
    };
    if (profile.role === "TENANT") {
      body.institution = nullable(form.institution);
      body.expectedMoveIn = nullable(form.expectedMoveIn);
    }
    if (profile.role === "LANDLORD") {
      body.organisation = nullable(form.organisation);
      body.propertyCount = form.propertyCount
        ? Number(form.propertyCount)
        : null;
    }

    try {
      const updated = await apiRequest<UserProfile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setProfile(updated);
      setForm(toForm(updated));
      setSaved(true);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Profile update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setSigningOut(true);
    setSaveError("");
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Logout failed.");
      setSigningOut(false);
    }
  }

  if (loading) return <p className="account-state">Loading your profile…</p>;
  if (loadError || !profile || !form) {
    return (
      <div className="account-state">
        <p role="alert">{loadError || "You are not signed in."}</p>
        <Link className="button" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  const verification =
    "verificationStatus" in profile
      ? verificationLabel(profile.verificationStatus)
      : "Not applicable";

  return (
    <section className="account-card profile-card">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">Profile settings</p>
          <h1>Your Hira profile</h1>
          <p>Keep your account details current and accurate.</p>
        </div>
        <button
          className="button button-outline button-small"
          type="button"
          onClick={logout}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <dl className="profile-summary">
        <div>
          <dt>Role</dt>
          <dd>{roleLabel(profile.role)}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{profile.status}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>{verification}</dd>
        </div>
      </dl>

      <form className="auth-form profile-form" onSubmit={save}>
        <div className="field-row">
          <ProfileInput
            label="First name"
            value={form.firstName}
            onChange={(value) => setField("firstName", value)}
            required
            maxLength={80}
            autoComplete="given-name"
          />
          <ProfileInput
            label="Last name"
            value={form.lastName}
            onChange={(value) => setField("lastName", value)}
            required
            maxLength={80}
            autoComplete="family-name"
          />
        </div>
        <label>
          Email address
          <input value={profile.email} type="email" readOnly />
          <small>Email changes are not available in this version.</small>
        </label>
        <ProfileInput
          label="Phone"
          value={form.phone}
          onChange={(value) => setField("phone", value)}
          maxLength={40}
          autoComplete="tel"
        />
        <ProfileInput
          label="Contact preference / method"
          value={form.contactMethod}
          onChange={(value) => setField("contactMethod", value)}
          maxLength={80}
        />

        {profile.role === "TENANT" && (
          <>
            <ProfileInput
              label="Institution"
              value={form.institution}
              onChange={(value) => setField("institution", value)}
              maxLength={160}
            />
            <label>
              Expected move-in date
              <input
                type="date"
                value={form.expectedMoveIn}
                onChange={(event) =>
                  setField("expectedMoveIn", event.target.value)
                }
              />
            </label>
          </>
        )}

        {profile.role === "LANDLORD" && (
          <>
            <ProfileInput
              label="Organisation"
              value={form.organisation}
              onChange={(value) => setField("organisation", value)}
              maxLength={160}
            />
            <label>
              Declared property count
              <input
                type="number"
                min="0"
                step="1"
                value={form.propertyCount}
                onChange={(event) =>
                  setField("propertyCount", event.target.value)
                }
              />
              <small>
                Your declared portfolio size, not a count of Hira listings.
              </small>
            </label>
          </>
        )}

        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        {saved && (
          <p className="form-success" role="status">
            Profile saved successfully.
          </p>
        )}
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Saving profile…" : "Save profile"}
        </button>
      </form>
    </section>
  );
}

type ProfileInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength: number;
  autoComplete?: string;
};

function ProfileInput({
  label,
  value,
  onChange,
  required,
  maxLength,
  autoComplete,
}: ProfileInputProps) {
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function toForm(profile: UserProfile): ProfileForm {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? "",
    contactMethod: profile.contactMethod ?? "",
    institution:
      profile.role === "TENANT"
        ? (profile.tenantProfile.institution ?? "")
        : "",
    expectedMoveIn:
      profile.role === "TENANT" && profile.tenantProfile.expectedMoveIn
        ? profile.tenantProfile.expectedMoveIn.slice(0, 10)
        : "",
    organisation:
      profile.role === "LANDLORD"
        ? (profile.landlordProfile.organisation ?? "")
        : "",
    propertyCount:
      profile.role === "LANDLORD" &&
      profile.landlordProfile.propertyCount !== null
        ? String(profile.landlordProfile.propertyCount)
        : "",
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function roleLabel(role: UserProfile["role"]): string {
  if (role === "TENANT") return "Student / Tenant";
  if (role === "LANDLORD") return "Landlord";
  return "Administrator";
}

function verificationLabel(
  status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED",
): string {
  return {
    NOT_SUBMITTED: "Not submitted",
    PENDING: "Pending review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  }[status];
}
