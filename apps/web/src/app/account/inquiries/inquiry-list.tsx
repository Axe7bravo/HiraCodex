"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, type Inquiry, type UserProfile } from "@/lib/api";
import { TenantEmpty, TenantShell, TenantStatus } from "@/components/tenant-shell";
import { LandlordShell, LandlordStatus } from "@/components/landlord-shell";

export function InquiryList() {
  const [role, setRole] = useState<"TENANT" | "LANDLORD" | "ADMIN" | null>(null);
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<UserProfile>("/users/me"),
      apiRequest<Inquiry[]>("/inquiries"),
    ])
      .then(([user, inquiries]) => {
        if (user.role === "TENANT" || user.role === "LANDLORD" || user.role === "ADMIN")
          setRole(user.role);
        setItems(inquiries);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(
    inquiryId: string,
    status: "RESPONDED" | "CLOSED",
  ) {
    setUpdatingId(inquiryId);
    setUpdateError("");
    setUpdateSuccess("");
    try {
      const updated = await apiRequest<Inquiry>(
        `/inquiries/${inquiryId}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUpdateSuccess(
        status === "RESPONDED"
          ? "Inquiry marked as responded."
          : "Inquiry closed.",
      );
    } catch (reason) {
      setUpdateError((reason as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  const content = (
    <section className={role === "TENANT" ? "tenant-account-page" : isLandlordContext(role) ? "landlord-account-page landlord-records-page inquiry-list" : "discovery-shell inquiry-list"}>
      <header className={role === "TENANT" ? "tenant-page-heading" : isLandlordContext(role) ? "landlord-page-heading" : "discovery-heading"}>
        <p className="eyebrow">Account</p>
        <h1>{isLandlordContext(role) ? "Property inquiries" : "Your inquiries"}</h1>
        <p>
          {isLandlordContext(role)
            ? "Questions received for properties you manage."
            : "Questions you have sent to landlords."}
        </p>
      </header>
      {loading && <p className={role === "TENANT" ? "tenant-page-state tenant-loading-state" : "discovery-state"}>Loading inquiries…</p>}
      {error && (
        <p className="discovery-state state-failure" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        role === "TENANT" ? <TenantEmpty title="No inquiries yet" copy="You haven't contacted a landlord yet." action="Find housing" /> : <div className="discovery-state discovery-empty"><h2>No inquiries yet</h2></div>
      )}
      {items.length > 0 && (
        <div className="inquiry-cards">
          {items.map((inquiry) => (
            <article key={inquiry.id} className={role === "TENANT" ? "inquiry-card tenant-record-card" : isLandlordContext(role) ? "inquiry-card landlord-record-card" : "inquiry-card"}>
              <div>
                {role === "TENANT" ? <TenantStatus status={inquiry.status} /> : isLandlordContext(role) ? <LandlordStatus status={inquiry.status} /> : <span className="status-badge">{inquiry.status}</span>}
                <h2>
                  <Link href={`/properties/${inquiry.property.id}`}>
                    {inquiry.property.title}
                  </Link>
                </h2>
                <p>
                  {inquiry.property.area}, {inquiry.property.city} ·{" "}
                  {inquiry.property.roomType} · M {Number(inquiry.property.monthlyPrice).toLocaleString()} / month
                </p>
              </div>
              <p>{inquiry.message}</p>
              {inquiry.moveInDate && (
                <p>
                  Preferred move-in:{" "}
                  {new Date(inquiry.moveInDate).toLocaleDateString("en-LS")}
                </p>
              )}
              {isLandlordContext(role) && inquiry.tenant && (
                <div className="inquiry-contact">
                  <strong>
                    {inquiry.tenant.firstName} {inquiry.tenant.lastName}
                  </strong>
                  <span>
                    {inquiry.tenant.verified
                      ? "Verified student"
                      : "Student verification not confirmed"}
                  </span>
                  {inquiry.tenant.institution && (
                    <span>{inquiry.tenant.institution}</span>
                  )}
                  {inquiry.tenant.phone && (
                    <span>
                      {inquiry.tenant.contactMethod ?? "Contact"}:{" "}
                      {inquiry.tenant.phone}
                    </span>
                  )}
                </div>
              )}
              {isLandlordContext(role) && inquiry.status !== "CLOSED" && (
                <div className="inquiry-status-actions">
                  {inquiry.status === "OPEN" && (
                    <button
                      className="button button-outline"
                      disabled={updatingId === inquiry.id}
                      onClick={() => updateStatus(inquiry.id, "RESPONDED")}
                    >
                      {updatingId === inquiry.id
                        ? "Updating…"
                        : "Mark responded"}
                    </button>
                  )}
                  <button
                    className="button button-outline"
                    disabled={updatingId === inquiry.id}
                    onClick={() => updateStatus(inquiry.id, "CLOSED")}
                  >
                    {updatingId === inquiry.id ? "Updating…" : "Close inquiry"}
                  </button>
                </div>
              )}
              <small>
                Sent {new Date(inquiry.createdAt).toLocaleDateString("en-LS")}
              </small>
            </article>
          ))}
        </div>
      )}
      {updateSuccess && (
        <p className="state-success" role="status">
          {updateSuccess}
        </p>
      )}
      {updateError && (
        <p className="state-failure" role="alert">
          {updateError}
        </p>
      )}
    </section>
  );
  return role === "TENANT" ? <TenantShell>{content}</TenantShell> : isLandlordContext(role) ? <LandlordShell role={role}>{content}</LandlordShell> : <main className="discovery-page">{content}</main>;
}

function isLandlordContext(role: "TENANT" | "LANDLORD" | "ADMIN" | null): role is "LANDLORD" | "ADMIN" {
  return role === "LANDLORD" || role === "ADMIN";
}
