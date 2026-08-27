"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiRequest,
  apiUrl,
  ApiError,
  type FavouriteItem,
  type PublicPropertyDetail,
  type UserProfile,
} from "@/lib/api";

function DetailPhoto({
  propertyId,
  photoId,
  title,
}: {
  propertyId: string;
  photoId: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="detail-photo">
      {failed ? (
        <span>Image unavailable</span>
      ) : (
        <Image
          fill
          unoptimized
          sizes="(max-width: 760px) 50vw, 33vw"
          src={`${apiUrl}/discovery/properties/${propertyId}/photos/${photoId}`}
          alt={`${title} photo`}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function PropertyDetail({ propertyId }: { propertyId: string }) {
  const [property, setProperty] = useState<PublicPropertyDetail | null>(null);
  const [viewer, setViewer] = useState<
    "loading" | "guest" | "tenant" | "other"
  >("loading");
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

  if (loading) return <p className="discovery-state">Loading property…</p>;
  if (error || !property)
    return (
      <div className="discovery-state state-failure" role="alert">
        <p>{error || "Property unavailable."}</p>
        <Link href="/properties">Back to properties</Link>
      </div>
    );

  return (
    <div className="property-detail-shell">
      <Link className="detail-back" href="/properties">
        ← Browse properties
      </Link>
      <section className="detail-gallery" aria-label="Property photos">
        {property.photos.length ? (
          property.photos.map((photo) => (
            <DetailPhoto
              key={photo.id}
              propertyId={property.id}
              photoId={photo.id}
              title={property.title}
            />
          ))
        ) : (
          <div className="detail-photo-placeholder">No photos available</div>
        )}
      </section>
      <div className="detail-layout">
        <article className="detail-copy">
          <p className="eyebrow">
            {property.roomType} · {property.area}, {property.city}
          </p>
          <h1>{property.title}</h1>
          <p className="detail-price">
            M {Number(property.monthlyPrice).toLocaleString()}{" "}
            <span>/ month</span>
          </p>
          <p>{property.description}</p>
          <h2>What this home offers</h2>
          <ul className="amenity-list">
            {property.amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
          <h2>Location and availability</h2>
          <p>
            {property.area}, {property.city}, {property.country}
          </p>
          <p>
            Near {property.nearestInstitution}
            {property.distanceNote ? ` · ${property.distanceNote}` : ""}
          </p>
          <p>
            Available{" "}
            {new Date(property.availableFrom).toLocaleDateString("en-LS")}
          </p>
        </article>
        <aside className="detail-landlord">
          <h2>
            Listed by {property.landlord.firstName} {property.landlord.lastName}
          </h2>
          {property.landlord.organisation && (
            <p>{property.landlord.organisation}</p>
          )}
          <p>
            {property.landlord.verified
              ? "Verified landlord"
              : "Landlord verification not confirmed"}
          </p>
          {viewer === "tenant" && (
            <>
              <button
                className="button button-outline"
                disabled={saving}
                onClick={toggleFavourite}
              >
                {saving
                  ? "Saving…"
                  : saved
                    ? "Remove from saved"
                    : "Save property"}
              </button>
              <form className="inquiry-form" onSubmit={sendInquiry}>
                <label htmlFor="inquiry-message">Message</label>
                <textarea
                  id="inquiry-message"
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <label htmlFor="inquiry-move-in">
                  Preferred move-in date <span>(optional)</span>
                </label>
                <input
                  id="inquiry-move-in"
                  type="date"
                  value={moveInDate}
                  onChange={(event) => setMoveInDate(event.target.value)}
                />
                <button
                  className="button button-primary"
                  disabled={sendingInquiry}
                >
                  {sendingInquiry ? "Sending…" : "Send inquiry"}
                </button>
                {inquirySent && (
                  <p className="state-success" role="status">
                    Inquiry sent successfully.
                  </p>
                )}
                {inquiryError && (
                  <p className="state-failure" role="alert">
                    {inquiryError}
                  </p>
                )}
              </form>
              <form
                className="inquiry-form request-form"
                onSubmit={requestAccommodation}
              >
                <h3>Request accommodation</h3>
                <label htmlFor="request-move-in">Preferred move-in date</label>
                <input
                  id="request-move-in"
                  type="date"
                  required
                  value={requestDate}
                  onChange={(event) => setRequestDate(event.target.value)}
                />
                <label htmlFor="request-note">
                  Note <span>(optional)</span>
                </label>
                <textarea
                  id="request-note"
                  maxLength={2000}
                  value={requestNote}
                  onChange={(event) => setRequestNote(event.target.value)}
                />
                <button className="button button-primary" disabled={requesting}>
                  {requesting ? "Submitting…" : "Request accommodation"}
                </button>
                {requestSent && (
                  <p className="state-success" role="status">
                    Accommodation request submitted.
                  </p>
                )}
                {requestError && (
                  <p className="state-failure" role="alert">
                    {requestError}
                  </p>
                )}
              </form>
            </>
          )}
          {viewer === "guest" && (
            <Link className="button button-primary" href="/login">
              Sign in to save or inquire
            </Link>
          )}
          {saveError && (
            <p className="state-failure" role="alert">
              {saveError}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
