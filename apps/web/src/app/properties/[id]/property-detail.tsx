"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Heart,
  Home,
  Images,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  apiRequest,
  apiUrl,
  ApiError,
  type FavouriteItem,
  type PublicPropertyDetail,
  type UserProfile,
} from "@/lib/api";

type Viewer = "loading" | "guest" | "tenant" | "other";

export function PropertyDetail({ propertyId }: { propertyId: string }) {
  const [property, setProperty] = useState<PublicPropertyDetail | null>(null);
  const [viewer, setViewer] = useState<Viewer>("loading");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState("");
  const [inquirySent, setInquirySent] = useState(false);
  const [requestDate, setRequestDate] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    async function load() {
      const detail = await apiRequest<PublicPropertyDetail>(
        `/discovery/properties/${propertyId}`,
      );
      setProperty(detail);
      try {
        const user = await apiRequest<UserProfile>("/users/me");
        if (user.role !== "TENANT") return setViewer("other");
        const favourites = await apiRequest<FavouriteItem[]>("/favourites");
        setSaved(favourites.some((item) => item.propertyId === propertyId));
        setViewer("tenant");
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 401)
          return setViewer("guest");
        throw reason;
      }
    }
    load()
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  async function toggleFavourite() {
    setSaving(true);
    setSaveError("");
    try {
      await apiRequest(`/favourites/${propertyId}`, {
        method: saved ? "DELETE" : "POST",
      });
      const favourites = await apiRequest<FavouriteItem[]>("/favourites");
      setSaved(favourites.some((item) => item.propertyId === propertyId));
    } catch (reason) {
      setSaveError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function sendInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingInquiry(true);
    setInquiryError("");
    setInquirySent(false);
    try {
      await apiRequest(`/properties/${propertyId}/inquiries`, {
        method: "POST",
        body: JSON.stringify({ message, moveInDate: moveInDate || null }),
      });
      setMessage("");
      setMoveInDate("");
      setInquirySent(true);
    } catch (reason) {
      setInquiryError((reason as Error).message);
    } finally {
      setSendingInquiry(false);
    }
  }

  async function requestAccommodation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequesting(true);
    setRequestError("");
    setRequestSent(false);
    try {
      await apiRequest(`/properties/${propertyId}/requests`, {
        method: "POST",
        body: JSON.stringify({
          preferredMoveInDate: requestDate,
          note: requestNote || null,
        }),
      });
      setRequestDate("");
      setRequestNote("");
      setRequestSent(true);
    } catch (reason) {
      setRequestError((reason as Error).message);
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return <PropertyDetailSkeleton />;
  if (error || !property)
    return (
      <div className="detail-state detail-state-error" role="alert">
        <Home aria-hidden="true" />
        <h1>Property unavailable</h1>
        <p>{error || "This listing could not be found."}</p>
        <Link href="/properties">Back to property discovery</Link>
      </div>
    );

  const formattedPrice = new Intl.NumberFormat("en-LS", {
    maximumFractionDigits: 2,
  }).format(Number(property.monthlyPrice));
  const formattedAvailability = new Date(
    property.availableFrom,
  ).toLocaleDateString("en-LS", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="property-detail-shell">
      <Link className="detail-back" href="/properties">
        <ArrowLeft aria-hidden="true" /> Back to results
      </Link>
      <header className="detail-heading">
        <div>
          {property.landlord.verified && (
            <p className="detail-trust-kicker">
              <BadgeCheck aria-hidden="true" /> Verified landlord
            </p>
          )}
          <h1>{property.title}</h1>
          <p>
            <MapPin aria-hidden="true" /> {property.area}, {property.city}
          </p>
        </div>
        {viewer === "tenant" && (
          <Button
            className="detail-save"
            type="button"
            variant="outline"
            disabled={saving}
            aria-pressed={saved}
            onClick={toggleFavourite}
          >
            <Heart aria-hidden="true" fill={saved ? "currentColor" : "none"} />
            {saving ? "Saving…" : saved ? "Remove from saved" : "Save property"}
          </Button>
        )}
      </header>

      <PropertyGallery property={property} />

      <section className="detail-attributes" aria-label="Property highlights">
        <DetailAttribute
          icon={<BedDouble />}
          label="Room type"
          value={property.roomType}
        />
        <DetailAttribute
          icon={<GraduationCap />}
          label="Nearest institution"
          value={property.nearestInstitution}
        />
        <DetailAttribute
          icon={<CalendarDays />}
          label="Available from"
          value={formattedAvailability}
        />
        <DetailAttribute
          icon={<MapPin />}
          label="Area"
          value={property.distanceNote || `${property.area}, Maseru`}
        />
      </section>

      <div className="detail-layout">
        <article className="detail-copy">
          <section>
            <p className="detail-section-kicker">A closer look</p>
            <h2>About this property</h2>
            <p className="detail-description">{property.description}</p>
          </section>
          <section className="detail-included">
            <p className="detail-section-kicker">Included</p>
            <h2>What this home offers</h2>
            <ul className="detail-amenities">
              {property.amenities.map((amenity) => (
                <li key={amenity}>
                  <BadgeCheck aria-hidden="true" /> {amenity}
                </li>
              ))}
            </ul>
          </section>
          <section className="detail-location-panel">
            <MapPin aria-hidden="true" />
            <div>
              <h2>Location context</h2>
              <p>
                {property.area}, {property.city}, {property.country}. Near{" "}
                {property.nearestInstitution}
                {property.distanceNote ? ` · ${property.distanceNote}` : ""}.
              </p>
            </div>
          </section>
        </article>

        <aside className="detail-actions">
          <section className="detail-action-card">
            <div className="detail-action-price">
              <strong>M{formattedPrice}</strong>
              <span>/ month</span>
            </div>
            <p className="detail-action-note">
              Contact the landlord through Hira. An inquiry or request is not a
              booking.
            </p>
            {viewer === "tenant" && (
              <>
                <details className="detail-action-disclosure">
                  <summary>
                    <span>
                      <MessageCircle aria-hidden="true" /> Ask the landlord
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </summary>
                  <form className="detail-action-form" onSubmit={sendInquiry}>
                    <Label htmlFor="inquiry-message">Message</Label>
                    <Textarea
                      id="inquiry-message"
                      required
                      maxLength={2000}
                      value={message}
                      placeholder="Ask about availability or arrange a viewing."
                      onChange={(event) => setMessage(event.target.value)}
                    />
                    <Label htmlFor="inquiry-move-in">
                      Preferred move-in date <span>(optional)</span>
                    </Label>
                    <Input
                      id="inquiry-move-in"
                      type="date"
                      value={moveInDate}
                      onChange={(event) => setMoveInDate(event.target.value)}
                    />
                    <Button type="submit" disabled={sendingInquiry}>
                      {sendingInquiry ? "Sending…" : "Send inquiry"}
                    </Button>
                    {inquirySent && (
                      <p className="detail-success" role="status">
                        Inquiry sent successfully.
                      </p>
                    )}
                    {inquiryError && (
                      <p className="detail-error" role="alert">
                        {inquiryError}
                      </p>
                    )}
                  </form>
                </details>
                <details className="detail-action-disclosure detail-request-disclosure">
                  <summary>
                    <span>
                      <ShieldCheck aria-hidden="true" /> Request accommodation
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </summary>
                  <form
                    className="detail-action-form"
                    onSubmit={requestAccommodation}
                  >
                    <p className="detail-form-help">
                      Use this higher-intent request when you are ready to ask
                      for this room.
                    </p>
                    <Label htmlFor="request-move-in">
                      Preferred move-in date
                    </Label>
                    <Input
                      id="request-move-in"
                      type="date"
                      required
                      value={requestDate}
                      onChange={(event) => setRequestDate(event.target.value)}
                    />
                    <Label htmlFor="request-note">
                      Note <span>(optional)</span>
                    </Label>
                    <Textarea
                      id="request-note"
                      maxLength={2000}
                      value={requestNote}
                      onChange={(event) => setRequestNote(event.target.value)}
                    />
                    <Button type="submit" disabled={requesting}>
                      {requesting ? "Submitting…" : "Request accommodation"}
                    </Button>
                    {requestSent && (
                      <p className="detail-success" role="status">
                        Accommodation request submitted.
                      </p>
                    )}
                    {requestError && (
                      <p className="detail-error" role="alert">
                        {requestError}
                      </p>
                    )}
                  </form>
                </details>
              </>
            )}
            {viewer === "guest" && (
              <Link
                className="button button-primary detail-sign-in"
                href="/login"
              >
                Sign in to save or inquire
              </Link>
            )}
            {saveError && (
              <p className="detail-error" role="alert">
                {saveError}
              </p>
            )}
          </section>
          <section className="detail-landlord-card">
            <span className="detail-landlord-avatar" aria-hidden="true">
              {property.landlord.firstName.charAt(0)}
              {property.landlord.lastName.charAt(0)}
            </span>
            <div>
              <small>Property owner</small>
              <h2>
                {property.landlord.firstName} {property.landlord.lastName}
              </h2>
              {property.landlord.organisation && (
                <p>{property.landlord.organisation}</p>
              )}
              <p
                className={
                  property.landlord.verified ? "is-verified" : undefined
                }
              >
                {property.landlord.verified ? (
                  <>
                    <BadgeCheck aria-hidden="true" /> Verified landlord
                  </>
                ) : (
                  "Landlord verification not confirmed"
                )}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function PropertyGallery({ property }: { property: PublicPropertyDetail }) {
  const [selectedId, setSelectedId] = useState(property.photos[0]?.id ?? null);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const selected =
    property.photos.find((photo) => photo.id === selectedId) ??
    property.photos[0];
  const selectedIndex = property.photos.findIndex(
    (photo) => photo.id === selected?.id,
  );
  const supporting = property.photos
    .filter((photo) => photo.id !== selected?.id)
    .slice(0, 3);
  if (!selected || failedIds.includes(selected.id))
    return (
      <div
        className="detail-gallery-empty"
        role="img"
        aria-label="Property photos unavailable"
      >
        <Home aria-hidden="true" />
        <strong>Photos unavailable</strong>
        <span>You can still review the listing details below.</span>
      </div>
    );
  return (
    <section className="detail-gallery" aria-label="Property photos">
      <div className="detail-gallery-main">
        <Image
          fill
          unoptimized
          priority
          sizes="(max-width: 760px) 100vw, 70vw"
          src={photoUrl(property.id, selected.id)}
          alt={`${property.title} main photo`}
          onError={() => setFailedIds((current) => [...current, selected.id])}
        />
        <span className="detail-photo-count">
          <Images aria-hidden="true" /> {selectedIndex + 1} /{" "}
          {property.photos.length}
        </span>
      </div>
      {supporting.length > 0 && (
        <div className="detail-gallery-thumbnails">
          {supporting.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              aria-label={`Show ${property.title} photo ${index + 2}`}
              onClick={() => setSelectedId(photo.id)}
            >
              {failedIds.includes(photo.id) ? (
                <span>Image unavailable</span>
              ) : (
                <Image
                  fill
                  unoptimized
                  sizes="(max-width: 760px) 33vw, 24vw"
                  src={photoUrl(property.id, photo.id)}
                  alt=""
                  onError={() =>
                    setFailedIds((current) => [...current, photo.id])
                  }
                />
              )}
              {index === 2 && property.photos.length > 4 && (
                <strong>+{property.photos.length - 4} photos</strong>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function DetailAttribute({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span aria-hidden="true">{icon}</span>
      <p>
        <small>{label}</small>
        <strong>{value}</strong>
      </p>
    </div>
  );
}

function PropertyDetailSkeleton() {
  return (
    <div
      className="property-detail-shell detail-skeleton"
      aria-label="Loading property"
    >
      <span className="sr-only">Loading property…</span>
      <i className="detail-skeleton-line" />
      <i className="detail-skeleton-title" />
      <i className="detail-skeleton-gallery" />
      <div className="detail-skeleton-attributes">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}

function photoUrl(propertyId: string, photoId: string) {
  return `${apiUrl}/discovery/properties/${propertyId}/photos/${photoId}`;
}
