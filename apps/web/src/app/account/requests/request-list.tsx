"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiRequest,
  type AccommodationRequest,
  type UserProfile,
} from "@/lib/api";

export function RequestList() {
  const [role, setRole] = useState<"TENANT" | "LANDLORD" | null>(null);
  const [items, setItems] = useState<AccommodationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<UserProfile>("/users/me"),
      apiRequest<AccommodationRequest[]>("/requests"),
    ])
      .then(([user, requests]) => {
        if (user.role === "TENANT" || user.role === "LANDLORD")
          setRole(user.role);
        setItems(requests);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  async function transition(
    request: AccommodationRequest,
    action: "accept" | "decline" | "cancel",
  ) {
    setUpdatingId(request.id);
    setMutationError("");
    setSuccess("");
    try {
      const updated = await apiRequest<AccommodationRequest>(
        `/requests/${request.id}/${action}`,
        { method: "PATCH" },
      );
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccess(`Request ${updated.status.toLowerCase()}.`);
    } catch (reason) {
      setMutationError((reason as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="discovery-shell inquiry-list">
      <header className="discovery-heading">
        <p className="eyebrow">Account</p>
        <h1>
          {role === "LANDLORD" ? "Accommodation requests" : "Your requests"}
        </h1>
        <p>
          {role === "LANDLORD"
            ? "Review requests for properties you manage."
            : "Track your accommodation requests."}
        </p>
      </header>
      {loading && <p className="discovery-state">Loading requests…</p>}
      {error && (
        <p className="discovery-state state-failure" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="discovery-state discovery-empty">
          <h2>No requests yet</h2>
          {role === "TENANT" && (
            <Link href="/properties">Browse properties</Link>
          )}
        </div>
      )}
      {items.length > 0 && (
        <div className="inquiry-cards">
          {items.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              role={role}
              updating={updatingId === request.id}
              transition={transition}
            />
          ))}
        </div>
      )}
      {success && (
        <p className="state-success" role="status">
          {success}
        </p>
      )}
      {mutationError && (
        <p className="state-failure" role="alert">
          {mutationError}
        </p>
      )}
    </div>
  );
}

function RequestCard({
  request,
  role,
  updating,
  transition,
}: {
  request: AccommodationRequest;
  role: "TENANT" | "LANDLORD" | null;
  updating: boolean;
  transition: (
    request: AccommodationRequest,
    action: "accept" | "decline" | "cancel",
  ) => Promise<void>;
}) {
  return (
    <article className="inquiry-card">
      <div>
        <span className="status-badge">{request.status}</span>
        <h2>
          <Link href={`/properties/${request.property.id}`}>
            {request.property.title}
          </Link>
        </h2>
        <p>
          {request.property.area}, {request.property.city} ·{" "}
          {request.property.roomType}
        </p>
      </div>
      <p>
        Preferred move-in:{" "}
        {new Date(request.preferredMoveInDate).toLocaleDateString("en-LS")}
      </p>
      {request.note && <p>{request.note}</p>}
      {role === "LANDLORD" && request.tenant && (
        <div className="inquiry-contact">
          <strong>
            {request.tenant.firstName} {request.tenant.lastName}
          </strong>
          <span>
            {request.tenant.verified
              ? "Verified student"
              : "Student verification not confirmed"}
          </span>
          {request.tenant.institution && (
            <span>{request.tenant.institution}</span>
          )}
          {request.tenant.phone && (
            <span>
              {request.tenant.contactMethod ?? "Contact"}:{" "}
              {request.tenant.phone}
            </span>
          )}
        </div>
      )}
      {request.status === "PENDING" && (
        <div className="inquiry-status-actions">
          {role === "TENANT" ? (
            <button
              className="button button-outline"
              disabled={updating}
              onClick={() => transition(request, "cancel")}
            >
              {updating ? "Updating…" : "Cancel request"}
            </button>
          ) : role === "LANDLORD" ? (
            <>
              <button
                className="button button-primary"
                disabled={updating}
                onClick={() => transition(request, "accept")}
              >
                {updating ? "Updating…" : "Accept"}
              </button>
              <button
                className="button button-outline"
                disabled={updating}
                onClick={() => transition(request, "decline")}
              >
                {updating ? "Updating…" : "Decline"}
              </button>
            </>
          ) : null}
        </div>
      )}
      <small>
        Submitted {new Date(request.createdAt).toLocaleDateString("en-LS")}
      </small>
    </article>
  );
}
