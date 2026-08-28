"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiRequest,
  type AccommodationRequest,
  type UserProfile,
} from "@/lib/api";
import { TenantEmpty, TenantShell, TenantStatus } from "@/components/tenant-shell";
import { LandlordShell } from "@/components/landlord-shell";

export function RequestList() {
  const [role, setRole] = useState<"TENANT" | "LANDLORD" | "ADMIN" | null>(null);
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
        if (user.role === "TENANT" || user.role === "LANDLORD" || user.role === "ADMIN")
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

  const content = (
    <section className={role === "TENANT" ? "tenant-account-page" : "discovery-shell inquiry-list"}>
      <header className={role === "TENANT" ? "tenant-page-heading" : "discovery-heading"}>
        <p className="eyebrow">Account</p>
        <h1>
          {isLandlordContext(role) ? "Accommodation requests" : "Your requests"}
        </h1>
        <p>
          {isLandlordContext(role)
            ? "Review requests for properties you manage."
            : "Track your accommodation requests."}
        </p>
      </header>
      {loading && <p className={role === "TENANT" ? "tenant-page-state tenant-loading-state" : "discovery-state"}>Loading requests…</p>}
      {error && (
        <p className="discovery-state state-failure" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        role === "TENANT" ? <TenantEmpty title="No accommodation requests yet" copy="You haven't requested accommodation yet." /> : <div className="discovery-state discovery-empty"><h2>No requests yet</h2></div>
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
    </section>
  );
  return role === "TENANT" ? <TenantShell>{content}</TenantShell> : isLandlordContext(role) ? <LandlordShell role={role}>{content}</LandlordShell> : <main className="discovery-page">{content}</main>;
}

function RequestCard({
  request,
  role,
  updating,
  transition,
}: {
  request: AccommodationRequest;
  role: "TENANT" | "LANDLORD" | "ADMIN" | null;
  updating: boolean;
  transition: (
    request: AccommodationRequest,
    action: "accept" | "decline" | "cancel",
  ) => Promise<void>;
}) {
  return (
    <article className={role === "TENANT" ? "inquiry-card tenant-record-card" : "inquiry-card"}>
      <div>
        {role === "TENANT" ? <TenantStatus status={request.status} /> : <span className="status-badge">{request.status}</span>}
        <h2>
          <Link href={`/properties/${request.property.id}`}>
            {request.property.title}
          </Link>
        </h2>
        <p>
          {request.property.area}, {request.property.city} ·{" "}
          {request.property.roomType} · M {Number(request.property.monthlyPrice).toLocaleString()} / month
        </p>
      </div>
      <p>
        Preferred move-in:{" "}
        {new Date(request.preferredMoveInDate).toLocaleDateString("en-LS")}
      </p>
      {request.note && <p>{request.note}</p>}
      {isLandlordContext(role) && request.tenant && (
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
          ) : isLandlordContext(role) ? (
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

function isLandlordContext(role: "TENANT" | "LANDLORD" | "ADMIN" | null): role is "LANDLORD" | "ADMIN" {
  return role === "LANDLORD" || role === "ADMIN";
}
