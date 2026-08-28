"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, UserProfile, VerificationSubmission } from "@/lib/api";
import { TenantStatus, TenantWorkspace } from "@/components/tenant-shell";
import { VerificationDocumentPreview } from "@/components/verification-document-preview";

const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
const maxBytes = 10 * 1024 * 1024;

export function VerificationClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] =
    useState<VerificationSubmission | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<UserProfile>("/users/me"),
      apiRequest<VerificationSubmission>("/verifications/me"),
    ])
      .then(([loadedProfile, loadedVerification]) => {
        setProfile(loadedProfile);
        setVerification(loadedVerification);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  function selectFiles(selected: FileList | null) {
    const next = Array.from(selected ?? []);
    const maximum = profile?.role === "LANDLORD" ? 1 : 3;
    if (next.length === 0 || next.length > maximum) {
      setFiles([]);
      setError(
        `Select ${maximum === 1 ? "exactly one" : "one to three"} document${maximum === 1 ? "" : "s"}.`,
      );
      return;
    }
    if (next.some((file) => !allowedTypes.includes(file.type))) {
      setFiles([]);
      setError("Documents must be PDF, JPEG, or PNG files.");
      return;
    }
    if (next.some((file) => file.size > maxBytes)) {
      setFiles([]);
      setError("Each document must be 10 MB or smaller.");
      return;
    }
    setError("");
    setFiles(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      setError("Select the required verification document(s).");
      return;
    }
    setSubmitting(true);
    setError("");
    const body = new FormData();
    files.forEach((file) => body.append("documents", file));
    try {
      const submitted = await apiRequest<VerificationSubmission>(
        "/verifications",
        { method: "POST", body },
      );
      setVerification(submitted);
      setFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="account-shell profile-shell"><p className="account-state">Loading verification…</p></div>;
  if (error && (!profile || !verification)) {
    return (
      <p className="account-state form-error" role="alert">
        {error}
      </p>
    );
  }
  if (!profile || !verification || profile.role === "ADMIN") {
    return (
      <p className="account-state form-error" role="alert">
        Verification is not available for this account.
      </p>
    );
  }

  const canSubmit =
    verification.status === "NOT_SUBMITTED" ||
    verification.status === "REJECTED";
  const landlord = profile.role === "LANDLORD";

  const card = (
    <section className={landlord ? "account-card profile-card verification-card" : "tenant-account-page tenant-verification-page"}>
      <div className={landlord ? undefined : "tenant-page-heading"}>
        <p className="eyebrow">Private document verification</p>
        <h1>
          {landlord
            ? "Verify your landlord account"
            : "Verify your student status"}
        </h1>
        <p>
          {landlord
            ? "Upload one landlord or business registration document."
            : "Upload one to three student ID or enrolment documents."}
        </p>
      </div>

      <div className={landlord ? `verification-status status-${verification.status.toLowerCase()}` : "tenant-verification-status"}>
        {landlord ? <strong>{statusLabel(verification.status)}</strong> : <TenantStatus status={verification.status} />}
        {verification.createdAt && (
          <span>
            Submitted {new Date(verification.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {verification.status === "REJECTED" && verification.rejectionReason && (
        <p className="form-error" role="alert">
          Review note: {verification.rejectionReason}
        </p>
      )}

      {verification.documents.length > 0 && (
        <section className="submitted-document-section" aria-labelledby="submitted-documents-title">
          <div><p className="eyebrow">Private evidence</p><h2 id="submitted-documents-title">Your submitted document{verification.documents.length === 1 ? "" : "s"}</h2></div>
          <ul className="document-list">
          {verification.documents.map((document) => (
            <li key={document.id}>
              <VerificationDocumentPreview endpoint={`/verifications/me/documents/${document.id}`} document={document} context="Your verification evidence" />
            </li>
          ))}
          </ul>
        </section>
      )}

      {canSubmit && (
        <form className="auth-form" onSubmit={submit}>
          <label>
            {landlord ? "Verification document" : "Verification documents"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              multiple={!landlord}
              onChange={(event) => selectFiles(event.target.files)}
            />
            <small>PDF, JPEG, or PNG. Maximum 10 MB per file.</small>
          </label>
          {files.length > 0 && (
            <SelectedFiles files={files} />
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" type="submit" disabled={submitting}>
            {submitting
              ? "Submitting securely…"
              : verification.status === "REJECTED"
                ? "Resubmit documents"
                : "Submit for review"}
          </button>
        </form>
      )}

      <p className="privacy-note">
        Your documents are private and used only for Hira verification. They are
        not published with your profile.
      </p>
      <Link href="/account">Back to profile</Link>
    </section>
  );
  return landlord ? <div className="account-shell profile-shell">{card}</div> : <div className="account-overview-shell"><TenantWorkspace>{card}</TenantWorkspace></div>;
}

function SelectedFiles({ files }: { files: File[] }) {
  const [previews, setPreviews] = useState<{ name: string; type: string; url?: string }[]>([]);
  useEffect(() => {
    const next = files.map((file) => ({ name: file.name, type: file.type, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }));
    setPreviews(next);
    return () => next.forEach((preview) => { if (preview.url) URL.revokeObjectURL(preview.url); });
  }, [files]);
  return <div className="tenant-selected-files" aria-live="polite">{previews.map((preview) => <article key={preview.name}>{preview.url ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview.url} alt={`Selected verification evidence: ${preview.name}`} /></> : <span>PDF</span>}<div><strong>{preview.name}</strong><small>{preview.type}</small></div></article>)}</div>;
}

function statusLabel(status: VerificationSubmission["status"]): string {
  return {
    NOT_SUBMITTED: "Not submitted",
    PENDING: "Pending review",
    APPROVED: "Approved",
    REJECTED: "Changes required",
  }[status];
}
