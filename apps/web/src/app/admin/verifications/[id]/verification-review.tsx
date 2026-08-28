"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminVerificationDetail,
  ApiError,
  apiRequest,
} from "@/lib/api";
import { AdminStatus } from "@/components/admin-shell";
import { VerificationDocumentPreview } from "@/components/verification-document-preview";

export function AdminVerificationReview({ id }: { id: string }) {
  const [detail, setDetail] = useState<AdminVerificationDetail | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setDetail(
        await apiRequest<AdminVerificationDetail>(`/admin/verifications/${id}`),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Review could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    apiRequest<AdminVerificationDetail>(`/admin/verifications/${id}`)
      .then(setDetail)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function decide(status: "APPROVED" | "REJECTED", event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setError("");
    try {
      setDetail(
        await apiRequest<AdminVerificationDetail>(
          `/admin/verifications/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status,
              ...(status === "REJECTED" ? { rejectionReason: reason } : {}),
            }),
          },
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Decision failed.");
      if (reason instanceof ApiError && reason.status === 409) await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="admin-screen-state admin-loading-state" role="status">Loading verification…</p>;
  if (!detail)
    return (
      <p className="account-state form-error" role="alert">
        {error || "Verification not found."}
      </p>
    );

  const pending = detail.status === "PENDING";
  return (
    <section className="admin-work-card admin-review-card admin-detail-card">
      <header className="admin-page-heading">
        <div>
        <p className="eyebrow">Verification review</p>
        <h1>
          {detail.user.firstName} {detail.user.lastName}
        </h1>
        <p>
          {detail.user.email} ·{" "}
          {detail.type === "STUDENT" ? "Student" : "Landlord"}
        </p>
        </div>
      </header>
      <div className="admin-detail-status">
        <AdminStatus status={detail.status} />
        <span>
          Submitted {new Date(detail.createdAt!).toLocaleDateString()}
        </span>
      </div>
      <p>
        {detail.type === "STUDENT"
          ? detail.user.tenantProfile?.institution || "Institution not provided"
          : detail.user.landlordProfile?.organisation ||
            "Organisation not provided"}
      </p>
      <ul className="document-list">
        {detail.documents.map((document) => (
          <li key={document.id}>
            <VerificationDocumentPreview endpoint={`/admin/verifications/${detail.id}/documents/${document.id}`} document={document} />
          </li>
        ))}
      </ul>
      {detail.rejectionReason && (
        <p className="form-error">Reason: {detail.rejectionReason}</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="review-actions">
          <button
            className="button"
            disabled={saving}
            onClick={() => void decide("APPROVED")}
          >
            Approve
          </button>
          <form
            className="auth-form"
            onSubmit={(event) => void decide("REJECTED", event)}
          >
            <label>
              Rejection reason
              <textarea
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button
              className="button button-danger"
              disabled={saving}
              type="submit"
            >
              Reject
            </button>
          </form>
        </div>
      )}
      <Link href="/admin/verifications">Back to queue</Link>
    </section>
  );
}
