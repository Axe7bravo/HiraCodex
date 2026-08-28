"use client";

import {
  type CSSProperties,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  apiRequest,
  apiUrl,
  type DiscoveryPage,
  type DiscoveryProperty,
} from "@/lib/api";
import { trackAnalytics } from "@/lib/analytics";
import {
  discoveryAmenities,
  discoveryAreas,
  discoveryInstitutions,
  discoveryPriceRange,
  discoveryRoomTypes,
} from "./discovery-options";

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
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [area, setArea] = useState(searchParams.get("area") ?? "");
  const [roomType, setRoomType] = useState(searchParams.get("roomType") ?? "");
  const [availableBy, setAvailableBy] = useState(
    searchParams.get("availableBy") ?? "",
  );
  const [nearestInstitution, setNearestInstitution] = useState(
    searchParams.get("nearestInstitution") ?? "",
  );
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(() =>
    (searchParams.get("amenities") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const initialMinPrice = searchParams.get("minPrice");
  const initialMaxPrice = searchParams.get("maxPrice");
  const [minPrice, setMinPrice] = useState(
    clampPrice(initialMinPrice, discoveryPriceRange.min),
  );
  const [maxPrice, setMaxPrice] = useState(
    clampPrice(initialMaxPrice, discoveryPriceRange.max),
  );
  const [minPriceActive, setMinPriceActive] = useState(
    Boolean(initialMinPrice),
  );
  const [maxPriceActive, setMaxPriceActive] = useState(
    Boolean(initialMaxPrice),
  );
  const datePickerRef = useRef<HTMLInputElement>(null);
  const trackedQueries = useRef(new Set<string>());
  const priceRangeStyle: CSSProperties &
    Record<"--range-start" | "--range-end", string> = {
    "--range-start": `${pricePercent(minPrice)}%`,
    "--range-end": `${pricePercent(maxPrice)}%`,
  };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(max-width: 900px)");
    const syncFilterVisibility = () => setFiltersOpen(!media.matches);
    media.addEventListener("change", syncFilterVisibility);
    return () => media.removeEventListener("change", syncFilterVisibility);
  }, []);

  useEffect(() => {
    const syncControlsFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const nextMinPrice = params.get("minPrice");
      const nextMaxPrice = params.get("maxPrice");
      setArea(params.get("area") ?? "");
      setRoomType(params.get("roomType") ?? "");
      setAvailableBy(params.get("availableBy") ?? "");
      setNearestInstitution(params.get("nearestInstitution") ?? "");
      setSelectedAmenities(
        (params.get("amenities") ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      setMinPrice(clampPrice(nextMinPrice, discoveryPriceRange.min));
      setMaxPrice(clampPrice(nextMaxPrice, discoveryPriceRange.max));
      setMinPriceActive(Boolean(nextMinPrice));
      setMaxPriceActive(Boolean(nextMaxPrice));
    };
    window.addEventListener("popstate", syncControlsFromHistory);
    return () =>
      window.removeEventListener("popstate", syncControlsFromHistory);
  }, []);

  useEffect(() => {
    let current = true;
    apiRequest<DiscoveryPage>(
      `/discovery/properties${query ? `?${query}` : ""}`,
    )
      .then((data) => {
        if (!current) return;
        setResult(data);
        setError(null);
        if (!trackedQueries.current.has(query)) {
          trackedQueries.current.add(query);
          const trackedParams = new URLSearchParams(query);
          const trackedArea = trackedParams.get("area");
          const trackedInstitution = trackedParams.get("nearestInstitution");
          const trackedRoomType = trackedParams.get("roomType");
          trackAnalytics("property_search", {
            ...(trackedArea && discoveryAreas.some((area) => area === trackedArea)
              ? { area: trackedArea }
              : {}),
            ...(trackedInstitution &&
            discoveryInstitutions.some(
              (institution) => institution === trackedInstitution,
            )
              ? { nearestInstitution: trackedInstitution }
              : {}),
            ...(trackedRoomType &&
            discoveryRoomTypes.some((roomType) => roomType === trackedRoomType)
              ? { roomType: trackedRoomType }
              : {}),
            filtersActive: trackedParams.size > 0,
            resultCount: data.total,
          });
        }
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

  function clearFilters() {
    setArea("");
    setRoomType("");
    setAvailableBy("");
    setNearestInstitution("");
    setSelectedAmenities([]);
    setMinPrice(discoveryPriceRange.min);
    setMaxPrice(discoveryPriceRange.max);
    setMinPriceActive(false);
    setMaxPriceActive(false);
    router.push("/properties");
  }

  function toggleAmenity(amenity: string) {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((value) => value !== amenity)
        : [...current, amenity],
    );
  }

  function changePage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (page === 1) next.delete("page");
    else next.set("page", String(page));
    router.push(`/properties${next.size ? `?${next}` : ""}`);
  }

  return (
    <div className="marketplace-shell">
      <form className="marketplace-search-form" onSubmit={applyFilters}>
        <div className="marketplace-search-bar">
          <Label className="marketplace-search-field">
            <MapPin aria-hidden="true" />
            <span>
              <small>Location</small>
              <select
                aria-label="Location"
                name="area"
                value={area}
                onChange={(event) => setArea(event.target.value)}
              >
                <option value="">Any area</option>
                {discoveryAreas.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </span>
          </Label>
          <Label className="marketplace-search-field">
            <span className="search-currency" aria-hidden="true">
              M
            </span>
            <span>
              <small>Maximum budget</small>
              <Input
                aria-label="Maximum budget"
                name="maxPrice"
                inputMode="decimal"
                value={maxPriceActive ? String(maxPrice) : ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setMaxPriceActive(Boolean(value));
                  if (value) setMaxPrice(clampPrice(value, maxPrice));
                }}
                placeholder="Any budget"
              />
            </span>
          </Label>
          <div className="marketplace-search-field">
            <CalendarDays aria-hidden="true" />
            <span>
              <small>Move-in</small>
              <span className="marketplace-date-picker">
                <button
                  type="button"
                  aria-label="Choose move-in date"
                  onClick={() => {
                    const picker = datePickerRef.current;
                    if (!picker) return;
                    if (typeof picker.showPicker === "function") {
                      picker.showPicker();
                    } else {
                      picker.click();
                    }
                  }}
                >
                  {availableBy || "Anytime"}
                </button>
                <input
                  ref={datePickerRef}
                  className="marketplace-native-date-picker"
                  data-testid="move-in-calendar"
                  aria-hidden="true"
                  tabIndex={-1}
                  name="availableBy"
                  type="date"
                  value={availableBy}
                  onChange={(event) => setAvailableBy(event.target.value)}
                />
              </span>
              {availableBy && (
                <button
                  className="marketplace-date-clear"
                  type="button"
                  onClick={() => setAvailableBy("")}
                >
                  Clear date
                </button>
              )}
            </span>
          </div>
          <Label className="marketplace-search-field">
            <BedDouble aria-hidden="true" />
            <span>
              <small>Room type</small>
              <select
                aria-label="Room type"
                name="roomType"
                value={roomType}
                onChange={(event) => setRoomType(event.target.value)}
              >
                <option value="">Any room type</option>
                {discoveryRoomTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </span>
          </Label>
          <Button
            className="marketplace-search-button"
            type="submit"
            size="icon"
          >
            <Search aria-hidden="true" />
            <span className="sr-only">Search listings</span>
          </Button>
        </div>

        <div
          className="marketplace-trust-row"
          aria-label="Hira marketplace standards"
        >
          <div>
            <Search aria-hidden="true" />
            <span>
              <strong>Direct landlord inquiries</strong>
              <small>Send an inquiry when you find the right room</small>
            </span>
          </div>
          <div>
            <BadgeCheck aria-hidden="true" />
            <span>
              <strong>Built for student life</strong>
              <small>Practical homes near Maseru institutions</small>
            </span>
          </div>
        </div>

        <div className="marketplace-results-layout">
          <aside className="marketplace-filter-rail">
            <details
              open={filtersOpen}
              onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
            >
              <summary>
                <span>
                  <SlidersHorizontal aria-hidden="true" /> Filters
                </span>
                <span className="filter-mobile-label">Show or hide</span>
              </summary>
              <div className="marketplace-filter-content">
                <button
                  className="filter-clear"
                  type="button"
                  onClick={clearFilters}
                >
                  Clear all
                </button>

                <fieldset>
                  <legend>Price range</legend>
                  {minPriceActive && (
                    <input type="hidden" name="minPrice" value={minPrice} />
                  )}
                  <div className="marketplace-price-values" aria-live="polite">
                    <span>
                      Min: {minPriceActive ? formatLsl(minPrice) : "Any"}
                    </span>
                    <span>
                      Max: {maxPriceActive ? formatLsl(maxPrice) : "Any"}
                    </span>
                  </div>
                  <div
                    className="marketplace-dual-range"
                    style={priceRangeStyle}
                  >
                    <span aria-hidden="true" />
                    <Label className="sr-only" htmlFor="minimum-price">
                      Minimum price
                    </Label>
                    <input
                      id="minimum-price"
                      type="range"
                      min={discoveryPriceRange.min}
                      max={discoveryPriceRange.max}
                      step={discoveryPriceRange.step}
                      value={minPrice}
                      aria-valuetext={formatLsl(minPrice)}
                      onChange={(event) => {
                        setMinPriceActive(true);
                        setMinPrice(
                          Math.min(Number(event.target.value), maxPrice),
                        );
                      }}
                    />
                    <Label className="sr-only" htmlFor="maximum-price">
                      Maximum price
                    </Label>
                    <input
                      id="maximum-price"
                      type="range"
                      min={discoveryPriceRange.min}
                      max={discoveryPriceRange.max}
                      step={discoveryPriceRange.step}
                      value={maxPrice}
                      aria-valuetext={formatLsl(maxPrice)}
                      onChange={(event) => {
                        setMaxPriceActive(true);
                        setMaxPrice(
                          Math.max(Number(event.target.value), minPrice),
                        );
                      }}
                    />
                  </div>
                  <p>M50 increments. Leave untouched to search any price.</p>
                </fieldset>

                <fieldset>
                  <legend>Nearest institution</legend>
                  <Label htmlFor="nearest-institution">Institution</Label>
                  <select
                    id="nearest-institution"
                    name="nearestInstitution"
                    value={nearestInstitution}
                    onChange={(event) =>
                      setNearestInstitution(event.target.value)
                    }
                  >
                    <option value="">Any institution</option>
                    {discoveryInstitutions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <fieldset>
                  <legend>Amenities</legend>
                  {selectedAmenities.length > 0 && (
                    <input
                      type="hidden"
                      name="amenities"
                      value={selectedAmenities.join(",")}
                    />
                  )}
                  <details className="marketplace-multi-select">
                    <summary>
                      {amenitySummary(selectedAmenities)}
                      <span aria-hidden="true">⌄</span>
                    </summary>
                    <div>
                      {discoveryAmenities.map((amenity) => (
                        <Label key={amenity}>
                          <input
                            type="checkbox"
                            checked={selectedAmenities.includes(amenity)}
                            onChange={() => toggleAmenity(amenity)}
                          />
                          {amenity}
                        </Label>
                      ))}
                    </div>
                  </details>
                </fieldset>

                <Button
                  className="filter-submit"
                  type="submit"
                  variant="secondary"
                >
                  Show {result?.total ?? "matching"} homes
                </Button>
              </div>
            </details>
          </aside>

          <section
            className="marketplace-results"
            aria-labelledby="results-title"
          >
            <div className="marketplace-results-toolbar">
              <div>
                <p className="marketplace-results-kicker">
                  Student housing marketplace
                </p>
                <h1 id="results-title">
                  {result
                    ? `${result.total} results in Maseru`
                    : "Homes in Maseru"}
                </h1>
              </div>
              <Label className="marketplace-sort">
                <span>Sort by</span>
                <select
                  name="sort"
                  defaultValue={searchParams.get("sort") ?? "newest"}
                >
                  <option value="newest">Most recent</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </Label>
            </div>

            {!result && !error && <DiscoverySkeleton />}
            {error && (
              <div className="discovery-state state-failure" role="alert">
                <strong>
                  {error.invalid
                    ? "Check your filters"
                    : "Listings unavailable"}
                </strong>
                <span>{error.message}</span>
              </div>
            )}
            {result?.items.length === 0 && (
              <div className="discovery-state discovery-empty">
                <Home aria-hidden="true" />
                <h2>No homes match these filters</h2>
                <p>Try widening your budget or clearing one of the filters.</p>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            {result && result.items.length > 0 && (
              <>
                <div className="marketplace-property-grid">
                  {result.items.map((property, index) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      eagerImage={index === 0}
                    />
                  ))}
                </div>
                <nav
                  className="marketplace-pagination"
                  aria-label="Listing pages"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={result.page <= 1}
                    onClick={() => changePage(result.page - 1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                    <span className="sr-only">Previous page</span>
                  </Button>
                  <span aria-current="page">{result.page}</span>
                  <small>of {result.totalPages}</small>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={result.page >= result.totalPages}
                    onClick={() => changePage(result.page + 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                    <span className="sr-only">Next page</span>
                  </Button>
                </nav>
              </>
            )}

            <div className="marketplace-promos">
              <div className="marketplace-promo marketplace-promo-lime">
                <Home aria-hidden="true" />
                <span>
                  <strong>Still finding the right place?</strong>
                  <small>
                    Adjust your filters to explore more approved homes.
                  </small>
                </span>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
              <div className="marketplace-promo marketplace-promo-blue">
                <Building2 aria-hidden="true" />
                <span>
                  <strong>Have student housing in Maseru?</strong>
                  <small>Join Hira and create your first property draft.</small>
                </span>
                <Link href="/register">List property</Link>
              </div>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}

function DiscoverySkeleton() {
  return (
    <div
      className="marketplace-property-grid"
      aria-label="Loading approved homes"
    >
      <span className="sr-only">Loading approved homes…</span>
      {Array.from({ length: 8 }, (_, index) => (
        <div className="marketplace-card marketplace-card-skeleton" key={index}>
          <div />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function PropertyCard({
  property,
  eagerImage,
}: {
  property: DiscoveryProperty;
  eagerImage: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const photo = property.photos[0];
  const price = new Intl.NumberFormat("en-LS", {
    style: "currency",
    currency: "LSL",
    maximumFractionDigits: 2,
  }).format(Number(property.monthlyPrice));

  return (
    <article className="marketplace-card">
      <Link
        className="marketplace-card-image"
        href={`/properties/${property.id}`}
      >
        {photo && !imageFailed ? (
          <Image
            src={`${apiUrl}/discovery/properties/${property.id}/photos/${photo.id}`}
            alt={`${property.title} listing`}
            fill
            sizes="(max-width: 680px) 100vw, (max-width: 1080px) 50vw, 25vw"
            unoptimized
            loading={eagerImage ? "eager" : "lazy"}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            className="marketplace-image-fallback"
            role="img"
            aria-label="Property image unavailable"
          >
            <Home aria-hidden="true" /> Image unavailable
          </span>
        )}
      </Link>
      <div className="marketplace-card-body">
        <h2>
          <Link href={`/properties/${property.id}`}>{property.title}</Link>
        </h2>
        <p className="marketplace-card-location">
          <MapPin aria-hidden="true" />
          <span>
            {property.area}, {property.city}
          </span>
        </p>
        <p className="marketplace-card-price">
          {price}
          <span> / month</span>
        </p>
        <p className="marketplace-card-room">{property.roomType}</p>
        <ul className="marketplace-amenities">
          {property.amenities.slice(0, 3).map((amenity) => (
            <li key={amenity}>{amenity}</li>
          ))}
        </ul>
      </div>
      <div className="marketplace-card-footer">
        <ShieldCheck aria-hidden="true" />
        <span>Approved listing</span>
      </div>
    </article>
  );
}

function clampPrice(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(
    discoveryPriceRange.max,
    Math.max(discoveryPriceRange.min, parsed),
  );
}

function formatLsl(value: number) {
  return new Intl.NumberFormat("en-LS", {
    style: "currency",
    currency: "LSL",
    maximumFractionDigits: 0,
  }).format(value);
}

function pricePercent(value: number) {
  return (
    ((value - discoveryPriceRange.min) /
      (discoveryPriceRange.max - discoveryPriceRange.min)) *
    100
  );
}

function amenitySummary(selected: string[]) {
  if (selected.length === 0) return "Any amenities";
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
}
