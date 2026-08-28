"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, apiUrl, type FavouriteItem } from "@/lib/api";
import { TenantEmpty } from "@/components/tenant-shell";

export function SavedProperties() {
  const [items, setItems] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const [removingId, setRemovingId] = useState("");
  useEffect(() => {
    apiRequest<FavouriteItem[]>("/favourites")
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);
  async function remove(propertyId: string) {
    setRemovingId(propertyId);
    setError("");
    try {
      await apiRequest(`/favourites/${propertyId}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.propertyId !== propertyId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Saved property could not be removed.");
    } finally {
      setRemovingId("");
    }
  }
  return (
    <section className="tenant-account-page">
      <header className="tenant-page-heading">
        <p className="eyebrow">Your shortlist</p>
        <h1>Saved properties</h1>
        <p>Approved homes you want to revisit.</p>
      </header>
      {loading && <p className="tenant-page-state tenant-loading-state" role="status">Loading saved properties…</p>}
      {error && (
        <p className="tenant-page-state state-failure" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <TenantEmpty title="No saved properties yet" copy="Save rooms you like while browsing Hira." />
      )}
      {items.length > 0 && (
        <div className="tenant-property-grid">
          {items.map(({ property }) => (
            <article className="tenant-property-card" key={property.id}>
              <div className="card-image">
                {property.photos[0] && !failedPhotos.includes(property.id) ? (
                  <Image
                    fill
                    unoptimized
                    sizes="(max-width: 760px) 100vw, 33vw"
                    src={`${apiUrl}/discovery/properties/${property.id}/photos/${property.photos[0].id}`}
                    alt={`${property.title} listing`}
                    onError={() =>
                      setFailedPhotos((current) => [...current, property.id])
                    }
                  />
                ) : (
                  <span>Image unavailable</span>
                )}
              </div>
              <div className="tenant-property-card-body">
                <h2>
                  <Link href={`/properties/${property.id}`}>
                    {property.title}
                  </Link>
                </h2>
                <p className="card-price">
                  M {Number(property.monthlyPrice).toLocaleString()} / month
                </p>
                <p>
                  {property.roomType} · {property.area}
                </p>
                <Link href={`/properties/${property.id}`}>View property</Link>
                <button className="tenant-unsave" type="button" disabled={removingId === property.id} onClick={() => void remove(property.id)}>{removingId === property.id ? "Removing…" : "Remove saved property"}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
