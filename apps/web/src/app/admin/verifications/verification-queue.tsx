"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminVerificationQueueItem, apiRequest } from "@/lib/api";
import { AdminStatus } from "@/components/admin-shell";

type Filter = "" | "STUDENT" | "LANDLORD";

export function AdminVerificationQueue() {
  const [items, setItems] = useState<AdminVerificationQueueItem[]>([]);
  const [filter, setFilter] = useState<Filter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<AdminVerificationQueueItem[]>(
      `/admin/verifications${filter ? `?type=${filter}` : ""}`,
    )
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [filter]);

  function changeFilter(value: Filter) {
    setLoading(true);
    setError("");
    setFilter(value);
  }

  return (
    <section className="admin-work-card admin-review-card">
      <header className="admin-page-heading">
        <div>
        <p className="eyebrow">Admin review</p>
        <h1>Pending verifications</h1>
        <p>Oldest submissions appear first.</p>
        </div>
      </header>
      <label className="admin-filter">
        Verification type
        <select
          value={filter}
          onChange={(event) => changeFilter(event.target.value as Filter)}
        >
          <option value="">All pending</option>
          <option value="STUDENT">Students</option>
          <option value="LANDLORD">Landlords</option>
        </select>
      </label>
      {loading && <p className="admin-screen-state admin-loading-state" role="status">Loading verification queue…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="admin-screen-state admin-empty-state"><ShieldCheck aria-hidden="true" /><strong>Verification queues are clear.</strong><span>No student or landlord submissions are awaiting review.</span></div>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="admin-verification-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {item.user.firstName} {item.user.lastName}
                </strong>
                <span>{item.type === "STUDENT" ? "Student" : "Landlord"}</span>
                <AdminStatus status="PENDING" />
                <small>
                  {context(item)} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString()} ·{" "}
                  {item.documentCount} document
                  {item.documentCount === 1 ? "" : "s"}
                </small>
              </div>
              <Link
                className="button button-outline button-small"
                href={`/admin/verifications/${item.id}`}
              >
                Open review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function context(item: AdminVerificationQueueItem): string {
  return item.type === "STUDENT"
    ? item.user.tenantProfile?.institution || "Institution not provided"
    : item.user.landlordProfile?.organisation || "Organisation not provided";
}
