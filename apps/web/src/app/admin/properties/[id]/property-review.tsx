"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminPropertyDetail, ApiError, apiRequest, apiUrl } from "@/lib/api";

export function AdminPropertyReview({ id }: { id: string }) {
  const [detail, setDetail] = useState<AdminPropertyDetail | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setDetail(
        await apiRequest<AdminPropertyDetail>(`/admin/properties/${id}`),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Property review could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    apiRequest<AdminPropertyDetail>(`/admin/properties/${id}`)
      .then(setDetail)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function decide(status: "ACTIVE" | "REJECTED", event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setError("");
    try {
      setDetail(
        await apiRequest<AdminPropertyDetail>(`/admin/properties/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status,
            ...(status === "REJECTED" ? { rejectionReason: reason } : {}),
          }),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Decision failed.");
      if (reason instanceof ApiError && reason.status === 409) await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="account-state">Loading property review…</p>;
  if (!detail)
    return (
      <p className="account-state form-error" role="alert">
        {error || "Property not found."}
      </p>
    );
  const pending = detail.status === "PENDING_REVIEW";
  return (
    <section className="account-card profile-card admin-review-card">
      <div>
        <p className="eyebrow">Property review</p>
        <h1>{detail.title}</h1>
        <p>
          {detail.area}, {detail.city} · M{detail.monthlyPrice}/month ·{" "}
          {detail.roomType}
        </p>
      </div>
      <div
        className={`verification-status status-${detail.status.toLowerCase()}`}
      >
        <strong>{detail.status.replaceAll("_", " ")}</strong>
        <span>
          Landlord: {detail.landlord.firstName} {detail.landlord.lastName}
        </span>
      </div>
      <div className="admin-property-details">
        <p>{detail.description}</p>
        <p>
          <strong>Available:</strong> {detail.availableFrom.slice(0, 10)}
        </p>
        <p>
          <strong>Nearest institution:</strong> {detail.nearestInstitution}
        </p>
        <p>
          <strong>Amenities:</strong> {detail.amenities.join(", ")}
        </p>
        <p>
          <strong>Landlord:</strong> {detail.landlord.email} ·{" "}
          {detail.landlord.landlordProfile?.organisation ||
            "Independent landlord"}
        </p>
      </div>
      <ul className="property-photo-grid">
        {detail.photos.map((photo) => (
          <li key={photo.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${apiUrl}/admin/properties/${detail.id}/photos/${photo.id}`}
              alt={photo.originalName}
            />
          </li>
        ))}
      </ul>
      {detail.rejectionReason && (
        <p className="form-error">Reason: {detail.rejectionReason}</p>
      )}
      {detail.review && (
        <p>
          Reviewed by {detail.review.actor.firstName}{" "}
          {detail.review.actor.lastName} on{" "}
          {new Date(detail.review.createdAt).toLocaleDateString()}.
        </p>
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
            onClick={() => void decide("ACTIVE")}
          >
            Approve and activate
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
      <Link href="/admin/properties">Back to property queue</Link>
    </section>
  );
}
