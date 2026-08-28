"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiRequest,
  type AccommodationRequest,
  type UserProfile,
} from "@/lib/api";
import { TenantShell, TenantStatus } from "@/components/tenant-shell";
import { LandlordShell, LandlordStatus } from "@/components/landlord-shell";

export function RequestList() {
  const [role, setRole] = useState<"TENANT" | "LANDLORD" | "ADMIN" | null>(null);
  const [items, setItems] = useState<AccommodationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

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
    reason?: string,
  ) {
    setUpdatingId(request.id);
    setMutationError("");
    setSuccess("");
    try {
      const updated = await apiRequest<AccommodationRequest>(
        `/requests/${request.id}/${action}`,
        {
          method: "PATCH",
          ...(action === "decline"
            ? { body: JSON.stringify({ reason: reason?.trim() }) }
            : {}),
        },
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

  const landlordContext = isLandlordContext(role);
  const currentRequests = items
    .filter(({ status }) => status === "PENDING" || status === "ACCEPTED")
    .sort((first, second) => {
      if (landlordContext && first.status !== second.status) {
        return first.status === "PENDING" ? -1 : 1;
      }
      return newestFirst(first.createdAt, second.createdAt);
    });
  const historyRequests = items
    .filter(({ status }) => status === "DECLINED" || status === "CANCELLED")
    .sort((first, second) => newestFirst(first.updatedAt, second.updatedAt));
  const visibleRequests = activeTab === "current" ? currentRequests : historyRequests;
  function selectTab(tab: "current" | "history", focus = false) {
    setActiveTab(tab);
    if (focus) document.getElementById(`request-tab-${tab}`)?.focus();
  }

  const content = (
    <section className={role === "TENANT" ? "tenant-account-page" : isLandlordContext(role) ? "landlord-account-page landlord-records-page inquiry-list" : "discovery-shell inquiry-list"}>
      <header className={role === "TENANT" ? "tenant-page-heading" : isLandlordContext(role) ? "landlord-page-heading" : "discovery-heading"}>
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
      {!loading && !error && (
        <div className="request-tabs" role="tablist" aria-label="Accommodation request views" onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            selectTab(activeTab === "current" ? "history" : "current", true);
          }
        }}>
          <button id="request-tab-current" role="tab" type="button" aria-selected={activeTab === "current"} aria-controls="request-panel-current" tabIndex={activeTab === "current" ? 0 : -1} onClick={() => selectTab("current")}>Current <span>{currentRequests.length}</span></button>
          <button id="request-tab-history" role="tab" type="button" aria-selected={activeTab === "history"} aria-controls="request-panel-history" tabIndex={activeTab === "history" ? 0 : -1} onClick={() => selectTab("history")}>History <span>{historyRequests.length}</span></button>
        </div>
      )}
      {!loading && !error && (
        <div id={`request-panel-${activeTab}`} role="tabpanel" aria-labelledby={`request-tab-${activeTab}`} className="request-tab-panel">
          {visibleRequests.length === 0 ? (
            <RequestEmpty tab={activeTab} role={role} />
          ) : <div className="inquiry-cards">
          {visibleRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              role={role}
              updating={updatingId === request.id}
              transition={transition}
            />
          ))}
          </div>}
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
    reason?: string,
  ) => Promise<void>;
}) {
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  return (
    <article className={`${role === "TENANT" ? "inquiry-card tenant-record-card" : isLandlordContext(role) ? "inquiry-card landlord-record-card" : "inquiry-card"}${isLandlordContext(role) && request.status === "PENDING" ? " request-card-attention" : ""}`}>
      <div>
        {role === "TENANT" ? <TenantStatus status={request.status} /> : isLandlordContext(role) ? <LandlordStatus status={request.status} /> : <span className="status-badge">{request.status}</span>}
        {isLandlordContext(role) && request.status === "PENDING" && (
          <span className="request-needs-response">Needs response</span>
        )}
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
      <p className="request-state-copy">{requestStateCopy(request.status, role)}</p>
      {request.note && <p>{request.note}</p>}
      {request.status === "DECLINED" && request.declineReason && (
        <div className="request-decline-reason">
          <strong>Reason from landlord</strong>
          <p>“{request.declineReason}”</p>
        </div>
      )}
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
                className="button button-danger"
                disabled={updating}
                onClick={() => setShowDecline(true)}
              >
                Decline request
              </button>
            </>
          ) : null}
        </div>
      )}
      {isLandlordContext(role) && request.status === "PENDING" && showDecline && (
        <form
          className="request-decline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void transition(request, "decline", declineReason);
          }}
        >
          <label htmlFor={`decline-reason-${request.id}`}>Reason for declining</label>
          <textarea
            id={`decline-reason-${request.id}`}
            value={declineReason}
            maxLength={500}
            onChange={(event) => setDeclineReason(event.target.value)}
            disabled={updating}
            required
          />
          <small>The tenant will be able to see this reason.</small>
          <div className="inquiry-status-actions">
            <button className="button button-outline" type="button" disabled={updating} onClick={() => { setShowDecline(false); setDeclineReason(""); }}>Cancel</button>
            <button className="button button-danger" type="submit" disabled={updating || !declineReason.trim()}>{updating ? "Declining…" : "Decline request"}</button>
          </div>
        </form>
      )}
      <small>
        Submitted {new Date(request.createdAt).toLocaleDateString("en-LS")}
      </small>
    </article>
  );
}

function RequestEmpty({ tab, role }: { tab: "current" | "history"; role: "TENANT" | "LANDLORD" | "ADMIN" | null }) {
  if (tab === "history") {
    return <div className="request-tab-empty"><h2>No previous requests yet.</h2></div>;
  }
  if (role === "TENANT") {
    return <div className="request-tab-empty"><h2>No active accommodation requests.</h2><p>Browse properties when you&apos;re ready to find your next place.</p><Link className="button button-small" href="/properties">Browse properties</Link></div>;
  }
  return <div className="request-tab-empty"><h2>No active accommodation requests.</h2><p>New tenant requests will appear here.</p></div>;
}

function requestStateCopy(status: AccommodationRequest["status"], role: "TENANT" | "LANDLORD" | "ADMIN" | null): string {
  if (status === "PENDING") return role === "TENANT" ? "Waiting for landlord response." : "Choose whether to accept or decline this request.";
  if (status === "ACCEPTED") return "Accommodation opportunity accepted.";
  if (status === "DECLINED") return "This request was declined by the landlord.";
  return "This request was cancelled.";
}

function newestFirst(first: string, second: string): number {
  return new Date(second).getTime() - new Date(first).getTime();
}

function isLandlordContext(role: "TENANT" | "LANDLORD" | "ADMIN" | null): role is "LANDLORD" | "ADMIN" {
  return role === "LANDLORD" || role === "ADMIN";
}
