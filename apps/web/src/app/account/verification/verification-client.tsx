"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiRequest, UserProfile, VerificationSubmission } from "@/lib/api";
import { TenantStatus, TenantWorkspace } from "@/components/tenant-shell";
import { VerificationDocumentPreview } from "@/components/verification-document-preview";
import { LandlordStatus, LandlordWorkspace } from "@/components/landlord-shell";

const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
const maxBytes = 10 * 1024 * 1024;

type SelectedVerificationFile = {
  file: File;
  previewUrl?: string;
};

export function VerificationClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] =
    useState<VerificationSubmission | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedVerificationFile[]>([]);
  const previewUrls = useRef(new Set<string>());
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

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  function revokePreviewUrls() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }

  function clearSelectedFiles() {
    revokePreviewUrls();
    setSelectedFiles([]);
  }

  function selectFiles(selected: FileList | null) {
    const next = Array.from(selected ?? []);
    const maximum = profile?.role === "LANDLORD" ? 1 : 3;
    if (next.length === 0 || next.length > maximum) {
      clearSelectedFiles();
      setError(
        `Select ${maximum === 1 ? "exactly one" : "one to three"} document${maximum === 1 ? "" : "s"}.`,
      );
      return;
    }
    if (next.some((file) => !allowedTypes.includes(file.type))) {
      clearSelectedFiles();
      setError("Documents must be PDF, JPEG, or PNG files.");
      return;
    }
    if (next.some((file) => file.size > maxBytes)) {
      clearSelectedFiles();
      setError("Each document must be 10 MB or smaller.");
      return;
    }
    revokePreviewUrls();
    const nextSelectedFiles = next.map((file) => {
      if (!file.type.startsWith("image/")) return { file };
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { file, previewUrl };
    });
    setError("");
    setSelectedFiles(nextSelectedFiles);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setError("Select the required verification document(s).");
      return;
    }
    setSubmitting(true);
    setError("");
    const body = new FormData();
    selectedFiles.forEach(({ file }) => body.append("documents", file));
    try {
      const submitted = await apiRequest<VerificationSubmission>(
        "/verifications",
        { method: "POST", body },
      );
      setVerification(submitted);
      clearSelectedFiles();
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
    <section className={landlord ? "landlord-account-page landlord-verification-page verification-card" : "tenant-account-page tenant-verification-page"}>
      <div className={landlord ? "landlord-page-heading" : "tenant-page-heading"}>
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

      <div className={landlord ? "landlord-verification-status" : "tenant-verification-status"}>
        {landlord ? <LandlordStatus status={verification.status} /> : <TenantStatus status={verification.status} />}
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
          {selectedFiles.length > 0 && (
            <SelectedFiles files={selectedFiles} />
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
  return landlord ? <div className="account-overview-shell"><LandlordWorkspace role="LANDLORD">{card}</LandlordWorkspace></div> : <div className="account-overview-shell"><TenantWorkspace>{card}</TenantWorkspace></div>;
}

function SelectedFiles({ files }: { files: SelectedVerificationFile[] }) {
  return <div className="tenant-selected-files" aria-live="polite">{files.map(({ file, previewUrl }) => <article key={file.name}>{previewUrl ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={previewUrl} alt={`Selected verification evidence: ${file.name}`} /></> : <span>PDF</span>}<div><strong>{file.name}</strong><small>{file.type}</small></div></article>)}</div>;
}

