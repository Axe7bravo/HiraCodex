"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError,
  apiRequest,
  apiUrl,
  type DiscoveryPage,
  type DiscoveryProperty,
} from "@/lib/api";

const filterNames = [
  "minPrice",
  "maxPrice",
  "area",
  "nearestInstitution",
  "availableBy",
  "roomType",
  "amenities",
  "sort",
] as const;

export function PropertyDiscovery() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.toString();
  const [result, setResult] = useState<DiscoveryPage | null>(null);
  const [error, setError] = useState<{
    message: string;
    invalid: boolean;
  } | null>(null);

  useEffect(() => {
    let current = true;
    apiRequest<DiscoveryPage>(
      `/discovery/properties${query ? `?${query}` : ""}`,
    )
      .then((data) => {
        if (!current) return;
        setResult(data);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setResult(null);
        setError({
          message:
            cause instanceof Error
              ? cause.message
              : "Listings could not be loaded.",
          invalid: cause instanceof ApiError && cause.status === 400,
        });
      });
    return () => {
      current = false;
    };
  }, [query]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const name of filterNames) {
      const value = String(data.get(name) ?? "").trim();
      if (value && !(name === "sort" && value === "newest")) {
        next.set(name, value);
      }
    }
    router.push(`/properties${next.size ? `?${next}` : ""}`);
  }

  function changePage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (page === 1) next.delete("page");
    else next.set("page", String(page));
    router.push(`/properties${next.size ? `?${next}` : ""}`);
  }

  return (
    <div className="discovery-shell">
      <header className="discovery-heading">
        <p className="eyebrow">Approved homes in Maseru</p>
        <h1>Find a room that fits student life.</h1>
        <p>
          Browse Hira-reviewed listings by budget, location and availability.
        </p>
      </header>

      <form className="discovery-filters" onSubmit={applyFilters}>
        <label>
          Minimum price
          <input
            name="minPrice"
            inputMode="decimal"
            defaultValue={searchParams.get("minPrice") ?? ""}
            placeholder="e.g. 800"
          />
        </label>
        <label>
          Maximum price
          <input
            name="maxPrice"
            inputMode="decimal"
            defaultValue={searchParams.get("maxPrice") ?? ""}
            placeholder="e.g. 2500"
          />
        </label>
        <label>
          Area
          <input
            name="area"
            defaultValue={searchParams.get("area") ?? ""}
            placeholder="e.g. Roma"
          />
        </label>
        <label>
          Nearest institution
          <input
            name="nearestInstitution"
            defaultValue={searchParams.get("nearestInstitution") ?? ""}
            placeholder="e.g. NUL"
          />
        </label>
        <label>
          Available by
          <input
            name="availableBy"
            type="date"
            defaultValue={searchParams.get("availableBy") ?? ""}
          />
        </label>
        <label>
          Room type
          <input
            name="roomType"
            defaultValue={searchParams.get("roomType") ?? ""}
            placeholder="e.g. Private room"
          />
        </label>
        <label>
          Amenities
          <input
            name="amenities"
            defaultValue={searchParams.get("amenities") ?? ""}
            placeholder="Wi-Fi, Parking"
          />
          <small>Separate multiple amenities with commas.</small>
        </label>
        <label>
          Sort by
          <select
            name="sort"
            defaultValue={searchParams.get("sort") ?? "newest"}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
        <div className="filter-actions">
          <button className="button" type="submit">
            Show listings
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={() => router.push("/properties")}
          >
            Clear
          </button>
        </div>
      </form>

      {!result && !error && (
        <p className="discovery-state">Loading approved homes…</p>
      )}
      {error && (
        <div className="discovery-state state-failure" role="alert">
          <strong>
            {error.invalid ? "Check your filters" : "Listings unavailable"}
          </strong>
          <span>{error.message}</span>
        </div>
      )}
      {result?.items.length === 0 && (
        <div className="discovery-state discovery-empty">
          <h2>No homes match these filters</h2>
          <p>Try widening your budget or clearing one of the filters.</p>
        </div>
      )}
      {result && result.items.length > 0 && (
        <section aria-labelledby="results-title">
          <div className="results-heading">
            <h2 id="results-title">
              {result.total} approved {result.total === 1 ? "home" : "homes"}
            </h2>
            <span>
              Page {result.page} of {result.totalPages}
            </span>
          </div>
          <div className="discovery-grid">
            {result.items.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
          <nav className="pagination" aria-label="Listing pages">
            <button
              className="button button-outline"
              disabled={result.page <= 1}
              onClick={() => changePage(result.page - 1)}
            >
              Previous
            </button>
            <button
              className="button button-outline"
              disabled={result.page >= result.totalPages}
              onClick={() => changePage(result.page + 1)}
            >
              Next
            </button>
          </nav>
        </section>
      )}
    </div>
  );
}

function PropertyCard({ property }: { property: DiscoveryProperty }) {
  const [imageFailed, setImageFailed] = useState(false);
  const photo = property.photos[0];
  const price = new Intl.NumberFormat("en-LS", {
    style: "currency",
    currency: "LSL",
    maximumFractionDigits: 2,
  }).format(Number(property.monthlyPrice));

  return (
    <article className="discovery-card">
      <div className="card-image">
        {photo && !imageFailed ? (
          <Image
            src={`${apiUrl}/discovery/properties/${property.id}/photos/${photo.id}`}
            alt={`${property.title} listing`}
            fill
            sizes="(max-width: 430px) 100vw, (max-width: 760px) 50vw, 33vw"
            unoptimized
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span role="img" aria-label="Property image unavailable">
            Image unavailable
          </span>
        )}
        <strong>Approved listing</strong>
      </div>
      <div className="card-body">
        <h3>{property.title}</h3>
        <p className="card-location">
          {property.area}, {property.city}
        </p>
        <p className="card-price">
          {price}
          <span> / month</span>
        </p>
        <p>
          {property.roomType} · Available{" "}
          {new Date(property.availableFrom).toLocaleDateString("en-LS")}
        </p>
        <p className="card-institution">Near {property.nearestInstitution}</p>
        <ul className="amenity-list">
          {property.amenities.slice(0, 3).map((amenity) => (
            <li key={amenity}>{amenity}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
