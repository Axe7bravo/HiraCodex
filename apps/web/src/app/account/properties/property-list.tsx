"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, LandlordProperty } from "@/lib/api";

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
    <section className="account-card profile-card property-management">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">Landlord listings</p>
          <h1>Your properties</h1>
          <p>Create and manage draft or paused listings.</p>
        </div>
        <Link className="button" href="/account/properties/new">
          Create property
        </Link>
      </div>
      {loading && <p role="status">Loading your properties…</p>}
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
        <div className="property-empty">
          <strong>No properties yet</strong>
          <p>Start with a draft. Photos and review submission come later.</p>
        </div>
      )}
      {!loading && properties.length > 0 && (
        <ul className="landlord-property-list">
          {properties.map((property) => (
            <li key={property.id}>
              <div>
                <span
                  className={`property-status status-${property.status.toLowerCase()}`}
                >
                  {statusLabel(property.status)}
                </span>
                <h2>{property.title}</h2>
                <p>
                  {property.area}, {property.city} · M{property.monthlyPrice}
                  /month
                </p>
                <small>
                  {property.roomType} · Available{" "}
                  {property.availableFrom.slice(0, 10)}
                </small>
              </div>
              <div className="property-actions">
                <Link
                  className="button button-outline button-small"
                  href={`/account/properties/${property.id}/edit`}
                >
                  Edit
                </Link>
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
                <button
                  className="button button-danger button-small"
                  disabled={busyId === property.id}
                  onClick={() => void remove(property)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/account">Back to profile</Link>
    </section>
  );
}

function statusLabel(status: LandlordProperty["status"]): string {
  return {
    DRAFT: "Draft",
    PAUSED: "Paused",
    PENDING_REVIEW: "Pending review",
    ACTIVE: "Active",
    REJECTED: "Rejected",
    INACTIVE: "Inactive",
  }[status];
}
