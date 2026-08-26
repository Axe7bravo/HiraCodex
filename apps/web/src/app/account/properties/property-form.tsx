"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { apiRequest, LandlordProperty } from "@/lib/api";
import { apiUrl } from "@/lib/api";

type PropertyFormState = {
  title: string;
  description: string;
  monthlyPrice: string;
  roomType: string;
  availableFrom: string;
  amenities: string;
  area: string;
  nearestInstitution: string;
  distanceNote: string;
  fullAddress: string;
  latitude: string;
  longitude: string;
};

const emptyForm: PropertyFormState = {
  title: "",
  description: "",
  monthlyPrice: "",
  roomType: "",
  availableFrom: "",
  amenities: "",
  area: "",
  nearestInstitution: "",
  distanceNote: "",
  fullAddress: "",
  latitude: "",
  longitude: "",
};

export function PropertyForm({ propertyId }: { propertyId?: string }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(Boolean(propertyId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<LandlordProperty | null>(null);
  const [property, setProperty] = useState<LandlordProperty | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    loadProperty(propertyId)
      .then((properties) => {
        setProperty(properties);
        setForm(toForm(properties));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  async function refreshProperty() {
    if (!propertyId) return;
    const authoritative = await loadProperty(propertyId);
    setProperty(authoritative);
  }

  function field(name: keyof PropertyFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setSaved(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(null);
    const body = {
      ...form,
      amenities: form.amenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      distanceNote: nullable(form.distanceNote),
      fullAddress: nullable(form.fullAddress),
      latitude: nullable(form.latitude),
      longitude: nullable(form.longitude),
    };
    try {
      const updated = await apiRequest<LandlordProperty>(
        propertyId ? `/properties/${propertyId}` : "/properties",
        {
          method: propertyId ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      setSaved(updated);
      if (propertyId) await refreshProperty();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Property could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="account-state">Loading property…</p>;

  return (
    <section className="account-card profile-card property-management">
      <div>
        <p className="eyebrow">Landlord listing</p>
        <h1>{propertyId ? "Edit property" : "Create a property"}</h1>
        <p>
          Save listing details, add 3–10 photos, then submit the listing for
          review.
        </p>
        {property && (
          <span
            className={`property-status status-${property.status.toLowerCase()}`}
          >
            {property.status.replaceAll("_", " ")}
          </span>
        )}
        {property?.status === "REJECTED" && property.rejectionReason && (
          <p className="form-error">
            Review feedback: {property.rejectionReason}
          </p>
        )}
      </div>
      {error && !form.title && propertyId ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        <form className="auth-form property-form" onSubmit={submit}>
          <fieldset disabled={Boolean(property && !isEditable(property))}>
            <PropertyInput
              label="Title"
              value={form.title}
              onChange={(value) => field("title", value)}
              minLength={3}
              maxLength={120}
              required
            />
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(event) => field("description", event.target.value)}
                minLength={20}
                maxLength={5000}
                required
              />
            </label>
            <div className="field-row">
              <PropertyInput
                label="Monthly price (LSL)"
                value={form.monthlyPrice}
                onChange={(value) => field("monthlyPrice", value)}
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?"
                required
              />
              <PropertyInput
                label="Room / property type"
                value={form.roomType}
                onChange={(value) => field("roomType", value)}
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <label>
              Available from
              <input
                type="date"
                value={form.availableFrom}
                onChange={(event) => field("availableFrom", event.target.value)}
                required
              />
            </label>
            <PropertyInput
              label="Amenities (comma separated)"
              value={form.amenities}
              onChange={(value) => field("amenities", value)}
              required
            />
            <div className="location-note">
              <strong>Location</strong>
              <span>Lesotho · Maseru</span>
            </div>
            <div className="field-row">
              <PropertyInput
                label="Area"
                value={form.area}
                onChange={(value) => field("area", value)}
                minLength={2}
                maxLength={120}
                required
              />
              <PropertyInput
                label="Nearest institution"
                value={form.nearestInstitution}
                onChange={(value) => field("nearestInstitution", value)}
                minLength={2}
                maxLength={160}
                required
              />
            </div>
            <PropertyInput
              label="Distance / travel note"
              value={form.distanceNote}
              onChange={(value) => field("distanceNote", value)}
              maxLength={250}
            />
            <PropertyInput
              label="Full address (kept out of marketplace scope for now)"
              value={form.fullAddress}
              onChange={(value) => field("fullAddress", value)}
              maxLength={300}
            />
            <div className="field-row">
              <PropertyInput
                label="Latitude (optional)"
                value={form.latitude}
                onChange={(value) => field("latitude", value)}
                inputMode="decimal"
              />
              <PropertyInput
                label="Longitude (optional)"
                value={form.longitude}
                onChange={(value) => field("longitude", value)}
                inputMode="decimal"
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="form-success" role="status">
                Property changes saved. Current status:{" "}
                {saved.status.replaceAll("_", " ")}.
              </p>
            )}
            <button className="button" disabled={saving} type="submit">
              {saving ? "Saving property…" : "Save property"}
            </button>
          </fieldset>
        </form>
      )}
      {propertyId && property && (
        <PhotoManager
          property={property}
          busy={photoBusy}
          setBusy={setPhotoBusy}
          onChanged={refreshProperty}
          setError={setError}
        />
      )}
      {propertyId && property && isEditable(property) && (
        <button
          className="button"
          disabled={photoBusy || property.photos.length < 3}
          onClick={() => void submitForReview()}
          type="button"
        >
          Submit for review
        </button>
      )}
      {saved && !propertyId && (
        <Link
          className="button button-outline"
          href={`/account/properties/${saved.id}/edit`}
        >
          Add photos to this property
        </Link>
      )}
      <Link href="/account/properties">Back to properties</Link>
    </section>
  );

  async function submitForReview() {
    if (
      !propertyId ||
      !window.confirm(
        "Submit this property for review? Editing and photo changes will be locked.",
      )
    )
      return;
    setPhotoBusy(true);
    setError("");
    try {
      await apiRequest(`/properties/${propertyId}/submit-review`, {
        method: "POST",
      });
      await refreshProperty();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Submission failed.");
    } finally {
      setPhotoBusy(false);
    }
  }
}

function PhotoManager({
  property,
  busy,
  setBusy,
  onChanged,
  setError,
}: {
  property: LandlordProperty;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onChanged: () => Promise<void>;
  setError: (value: string) => void;
}) {
  const editable = isEditable(property);
  async function upload(file?: File) {
    if (!file) return;
    const body = new FormData();
    body.append("photo", file);
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/properties/${property.id}/photos`, {
        method: "POST",
        body,
      });
      await onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Photo upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(photoId: string) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/properties/${property.id}/photos/${photoId}`, {
        method: "DELETE",
      });
      await onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Photo removal failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="property-photos"
      aria-labelledby="property-photos-heading"
    >
      <div>
        <h2 id="property-photos-heading">Property photos</h2>
        <p>
          {property.photos.length}/10 photos · JPEG, PNG or WebP · 5 MB maximum
          each
        </p>
      </div>
      {property.photos.length === 0 ? (
        <p className="property-empty">
          No photos uploaded yet. At least three are required for review.
        </p>
      ) : (
        <ul className="property-photo-grid">
          {property.photos.map((photo) => (
            <li key={photo.id}>
              {/* Private owner-only image endpoint; browser credentials authorize retrieval. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${apiUrl}/properties/${property.id}/photos/${photo.id}`}
                alt={photo.originalName}
              />
              {editable && (
                <button
                  className="button button-danger button-small"
                  disabled={busy}
                  onClick={() => void remove(photo.id)}
                  type="button"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && property.photos.length < 10 && (
        <label className="photo-upload">
          Add a photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          {busy && <span role="status">Updating photos…</span>}
        </label>
      )}
      {!editable && (
        <p>
          Photo changes are locked while this listing is{" "}
          {property.status.toLowerCase().replaceAll("_", " ")}.
        </p>
      )}
    </section>
  );
}

function isEditable(property: LandlordProperty) {
  return (
    property.status === "DRAFT" ||
    property.status === "PAUSED" ||
    property.status === "REJECTED"
  );
}

async function loadProperty(propertyId: string) {
  const properties = await apiRequest<LandlordProperty[]>("/properties/mine");
  const property = properties.find(({ id }) => id === propertyId);
  if (!property) throw new Error("Property not found.");
  return property;
}

function PropertyInput({
  label,
  value,
  onChange,
  ...input
}: { label: string; value: string; onChange: (value: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <label>
      {label}
      <input
        {...input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function nullable(value: string): string | null {
  return value.trim() || null;
}
function toForm(property: LandlordProperty): PropertyFormState {
  return {
    title: property.title,
    description: property.description,
    monthlyPrice: property.monthlyPrice,
    roomType: property.roomType,
    availableFrom: property.availableFrom.slice(0, 10),
    amenities: property.amenities.join(", "),
    area: property.area,
    nearestInstitution: property.nearestInstitution,
    distanceNote: property.distanceNote ?? "",
    fullAddress: property.fullAddress ?? "",
    latitude: property.latitude ?? "",
    longitude: property.longitude ?? "",
  };
}
