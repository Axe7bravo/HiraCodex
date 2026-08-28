"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, apiUrl, LandlordProperty } from "@/lib/api";
import { LandlordStatus } from "@/components/landlord-shell";

export function PropertyList() {
  const [properties, setProperties] = useState<LandlordProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiRequest<LandlordProperty[]>("/properties/mine")
      .then(setProperties)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  async function setStatus(property: LandlordProperty) {
    setBusyId(property.id);
    setError("");
    setSuccess("");
    try {
      const updated = await apiRequest<LandlordProperty>(
        `/properties/${property.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: property.status === "PAUSED" ? "DRAFT" : "PAUSED",
          }),
        },
      );
      setProperties((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccess(
        updated.status === "PAUSED"
          ? "Property paused."
          : "Property returned to draft.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Update failed.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(property: LandlordProperty) {
    if (!window.confirm(`Delete “${property.title}”? This cannot be undone.`)) {
      return;
    }
    setBusyId(property.id);
    setError("");
    setSuccess("");
    try {
      await apiRequest<void>(`/properties/${property.id}`, {
        method: "DELETE",
      });
      setProperties((current) =>
        current.filter((item) => item.id !== property.id),
      );
      setSuccess("Property deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delete failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="landlord-account-page property-management">
      <div className="landlord-page-heading">
        <div>
          <p className="eyebrow">Landlord listings</p>
          <h1>My properties</h1>
          <p>Manage each listing from draft through Hira review and publication.</p>
        </div>
        <Link className="button" href="/account/properties/new">
          Create listing
        </Link>
      </div>
      {loading && <p className="landlord-state" role="status">Loading your properties…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}
      {!loading && !error && properties.length === 0 && (
        <div className="landlord-empty-state">
          <strong>List your first property on Hira.</strong>
          <p>Create a draft, add photos, and submit it for review when it is ready.</p>
          <Link className="button button-small" href="/account/properties/new">Create listing</Link>
        </div>
      )}
      {!loading && properties.length > 0 && (
        <ul className="landlord-property-list">
          {properties.map((property) => (
            <li key={property.id}>
              <div className="landlord-listing-summary">
                <div className="landlord-listing-thumb">
                  {property.photos[0] ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`${apiUrl}/properties/${property.id}/photos/${property.photos[0].id}`} alt="" /></> : <span aria-hidden="true">Hira.</span>}
                </div>
                <div>
                <LandlordStatus status={property.status} />
                <h2>{property.title}</h2>
                <p>
                  {property.area}, {property.city} · M{property.monthlyPrice}
                  /month
                </p>
                <small>
                  {property.roomType} · Available{" "}
                  {property.availableFrom.slice(0, 10)}
                  {` · ${property.photos.length} photo${property.photos.length === 1 ? "" : "s"}`}
                </small>
                <p className="landlord-status-guidance">{statusGuidance(property.status)}</p>
                {property.status === "REJECTED" && property.rejectionReason && <p className="landlord-rejection-note">Review feedback: {property.rejectionReason}</p>}
                </div>
              </div>
              <div className="property-actions">
                {isEditable(property.status) && (
                  <Link
                    className="button button-outline button-small"
                    href={`/account/properties/${property.id}/edit`}
                  >
                    Manage property
                  </Link>
                )}
                {!isEditable(property.status) && (
                  <Link className="button button-outline button-small" href={`/account/properties/${property.id}/edit`}>
                    Manage property
                  </Link>
                )}
                {(property.status === "DRAFT" ||
                  property.status === "PAUSED") && (
                  <button
                    className="button button-outline button-small"
                    disabled={busyId === property.id}
                    onClick={() => void setStatus(property)}
                  >
                    {property.status === "PAUSED" ? "Return to draft" : "Pause"}
                  </button>
                )}
                {isEditable(property.status) && (
                  <button
                    className="button button-danger button-small"
                    disabled={busyId === property.id}
                    onClick={() => void remove(property)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function statusGuidance(status: LandlordProperty["status"]): string {
  return {
    DRAFT: "Continue editing and submit when the listing is ready.",
    PAUSED: "Not visible to students. Open Manage property to edit and resubmit it.",
    PENDING_REVIEW: "Awaiting review by the Hira team.",
    ACTIVE: "Live on Hira and visible to students.",
    REJECTED: "Update the listing using the review feedback, then resubmit.",
    INACTIVE: "This listing is not currently visible on Hira.",
  }[status];
}

function isEditable(status: LandlordProperty["status"]): boolean {
  return status === "DRAFT" || status === "PAUSED" || status === "REJECTED";
}
