"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPropertyQueueItem, apiRequest } from "@/lib/api";

export function AdminPropertyQueue() {
  const [items, setItems] = useState<AdminPropertyQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<AdminPropertyQueueItem[]>("/admin/properties")
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="account-card profile-card admin-review-card">
      <div>
        <p className="eyebrow">Property moderation</p>
        <h1>Pending property reviews</h1>
        <p>Oldest submissions appear first.</p>
      </div>
      {loading && <p role="status">Loading property queue…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p>No properties are awaiting review.</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="admin-verification-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.area}, {item.city} · M{item.monthlyPrice}/month
                </span>
                <small>
                  {item.landlord.firstName} {item.landlord.lastName} ·{" "}
                  {item.landlord.landlordProfile?.organisation ||
                    "Independent landlord"}{" "}
                  · {item.photoCount} photos · Submitted{" "}
                  {new Date(item.submittedAt).toLocaleDateString()}
                </small>
              </div>
              <Link
                className="button button-outline button-small"
                href={`/admin/properties/${item.id}`}
              >
                Review property
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
