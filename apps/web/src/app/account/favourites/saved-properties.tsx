"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, apiUrl, type FavouriteItem } from "@/lib/api";

export function SavedProperties() {
  const [items, setItems] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  useEffect(() => {
    apiRequest<FavouriteItem[]>("/favourites")
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="discovery-shell">
      <header className="discovery-heading">
        <p className="eyebrow">Your shortlist</p>
        <h1>Saved properties</h1>
        <p>Approved homes you want to revisit.</p>
      </header>
      {loading && <p className="discovery-state">Loading saved properties…</p>}
      {error && (
        <p className="discovery-state state-failure" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="discovery-state discovery-empty">
          <h2>No saved properties yet</h2>
          <Link href="/properties">Browse approved homes</Link>
        </div>
      )}
      {items.length > 0 && (
        <div className="discovery-grid">
          {items.map(({ property }) => (
            <article className="discovery-card" key={property.id}>
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
              <div className="card-body">
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
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
