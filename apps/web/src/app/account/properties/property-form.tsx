"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { apiRequest, LandlordProperty } from "@/lib/api";
import { apiUrl } from "@/lib/api";
import { LandlordStatus } from "@/components/landlord-shell";
import {
  discoveryAmenities,
  discoveryAreas,
  discoveryInstitutions,
  discoveryRoomTypes,
} from "@/app/properties/discovery-options";

type PropertyFormState = {
  title: string;
  description: string;
  monthlyPrice: string;
  roomType: string;
  availableFrom: string;
  amenities: string[];
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
  amenities: [],
  area: "",
  nearestInstitution: "",
  distanceNote: "",
  fullAddress: "",
  latitude: "",
  longitude: "",
};

export function PropertyForm({ propertyId }: { propertyId?: string }) {
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [loading, setLoading] = useState(Boolean(propertyId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<LandlordProperty | null>(null);
  const [property, setProperty] = useState<LandlordProperty | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pauseConfirmationOpen, setPauseConfirmationOpen] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState("");

  useEffect(() => {
    if (!propertyId) return;
    loadProperty(propertyId)
      .then((properties) => {
        const loadedForm = toForm(properties);
        setProperty(properties);
        setForm(loadedForm);
        setInitialForm(loadedForm);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  async function refreshProperty() {
    if (!propertyId) return;
    const authoritative = await loadProperty(propertyId);
    setProperty(authoritative);
  }

  function field(name: Exclude<keyof PropertyFormState, "amenities">, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setSaved(null);
  }

  function toggleAmenity(amenity: string) {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((value) => value !== amenity)
        : [...current.amenities, amenity],
    }));
    setSaved(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (propertyId && !isDirty) return;
    setSaving(true);
    setError("");
    setSaved(null);
    const body = {
      title: form.title,
      description: form.description,
      monthlyPrice: form.monthlyPrice,
      roomType: form.roomType,
      availableFrom: form.availableFrom,
      amenities: form.amenities,
      area: form.area,
      nearestInstitution: form.nearestInstitution,
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
      if (propertyId) {
        const authoritativeForm = toForm(updated);
        setProperty(updated);
        setForm(authoritativeForm);
        setInitialForm(authoritativeForm);
      }
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

  const editable = !property || isEditable(property);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  if (loading) return <p className="landlord-state" role="status">Loading property…</p>;

  return (
    <section className="landlord-account-page property-management landlord-listing-editor">
      <header className="landlord-page-heading landlord-property-heading">
        <div>
          <p className="eyebrow">{propertyId ? "Manage property" : "New listing"}</p>
          <h1>{property ? property.title : propertyId ? "Manage property" : "Create a property"}</h1>
          <p>
            {property
              ? `${property.area}, ${property.city} · M ${Number(property.monthlyPrice).toLocaleString()} / month`
              : "Add the listing details, then save your draft before uploading photos."}
          </p>
        </div>
        <div className="landlord-property-heading-actions">
          {property && <LandlordStatus status={property.status} />}
          <Link className="button button-outline button-small" href="/account/properties">
            Back to My properties
          </Link>
        </div>
      </header>
      {property && <LifecycleState property={property} />}
      {property?.status === "ACTIVE" && (
        <section className="landlord-active-management-actions" aria-label="Active listing actions">
          <div>
            <strong>Property details are currently locked</strong>
            <span>Pause this listing to make changes.</span>
          </div>
          <div>
            <Link className="button button-outline" href={`/properties/${property.id}`}>
              View listing
            </Link>
            <button
              className="button"
              disabled={pausing}
              onClick={() => {
                setPauseError("");
                setPauseConfirmationOpen(true);
              }}
              type="button"
            >
              Pause to edit
            </button>
          </div>
        </section>
      )}
      {property?.status === "ACTIVE" && pauseConfirmationOpen && (
        <section
          aria-labelledby="pause-listing-heading"
          aria-modal="true"
          className="landlord-pause-confirmation"
          role="alertdialog"
        >
          <div>
            <h2 id="pause-listing-heading">Pause this listing to edit it?</h2>
            <p>
              Pausing removes this listing from student search while you make changes.
              You&apos;ll need to submit it for Hira review again before it goes live.
            </p>
          </div>
          <div className="landlord-pause-confirmation-actions">
            <button
              className="button button-outline"
              disabled={pausing}
              onClick={() => setPauseConfirmationOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button"
              disabled={pausing}
              onClick={() => void pauseToEdit()}
              type="button"
            >
              {pausing ? "Pausing…" : "Pause to edit"}
            </button>
          </div>
        </section>
      )}
      {pauseError && (
        <p className="form-error" role="alert">
          {pauseError}
        </p>
      )}
      {property && !editable && (
        <aside className="landlord-readonly-notice" role="note">
          <strong>Property details are read-only</strong>
          <p>{readOnlyExplanation(property.status)}</p>
        </aside>
      )}
      {property?.status === "REJECTED" && property.rejectionReason && (
        <aside className="landlord-rejection-panel" aria-labelledby="listing-feedback-heading">
          <p className="eyebrow">Hira review feedback</p>
          <h2 id="listing-feedback-heading">This listing needs changes</h2>
          <p>{property.rejectionReason}</p>
          <span>Update the details or photos below, save your changes, and submit again when ready.</span>
        </aside>
      )}
      {error && !form.title && propertyId ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        <form className="auth-form property-form" onSubmit={submit}>
          <fieldset disabled={!editable}>
            <section className="landlord-form-card landlord-form-section" aria-labelledby="property-details-heading">
              <div className="landlord-form-section-heading"><span>01</span><div><h2 id="property-details-heading">Property details</h2><p>Describe the accommodation clearly for students.</p></div></div>
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
              <ControlledSelect
                label="Room / property type"
                value={form.roomType}
                onChange={(value) => field("roomType", value)}
                placeholder="Select room or property type"
                options={withLegacyOption(discoveryRoomTypes, form.roomType)}
              />
              </div>
            </section>

            <section className="landlord-form-card landlord-form-section" aria-labelledby="location-availability-heading">
              <div className="landlord-form-section-heading"><span>02</span><div><h2 id="location-availability-heading">Location &amp; availability</h2><p>Help students understand where the property is and when it is available.</p></div></div>
              <label>
                Available from
                <input
                  type="date"
                  value={form.availableFrom}
                  onChange={(event) => field("availableFrom", event.target.value)}
                  required
                />
              </label>
              <div className="location-note">
                <strong>Structured location</strong>
                <span>Lesotho · Maseru</span>
              </div>
              <div className="field-row">
              <ControlledSelect
                label="Area"
                value={form.area}
                onChange={(value) => field("area", value)}
                placeholder="Select area"
                options={withLegacyOption(discoveryAreas, form.area)}
              />
              <ControlledSelect
                label="Nearest institution"
                value={form.nearestInstitution}
                onChange={(value) => field("nearestInstitution", value)}
                placeholder="Select nearest institution"
                options={withLegacyOption(discoveryInstitutions, form.nearestInstitution)}
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
            </section>

            <section className="landlord-form-card landlord-form-section" aria-labelledby="amenities-heading">
              <div className="landlord-form-section-heading"><span>03</span><div><h2 id="amenities-heading">Amenities</h2><p>Select every facility currently available at the property.</p></div></div>
              <fieldset className="property-amenity-options">
                <legend>Available amenities</legend>
                {withLegacyOptions(discoveryAmenities, form.amenities).map((amenity) => (
                  <label key={amenity} className="property-amenity-option">
                    <input type="checkbox" checked={form.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />
                    <span>{amenity}{!discoveryAmenities.includes(amenity as (typeof discoveryAmenities)[number]) ? " (existing non-standard value)" : ""}</span>
                  </label>
                ))}
              </fieldset>
              {form.amenities.length === 0 && <small className="property-control-help">Select at least one amenity.</small>}
            </section>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="form-success" role="status">
                {propertyId
                  ? "Changes saved."
                  : `Property changes saved. Current status: ${saved.status.replaceAll("_", " ")}.`}
              </p>
            )}
            {editable && <div className="landlord-form-actions">
              <Link className="button button-outline" href="/account/properties">Cancel</Link>
              <button className="button" disabled={saving || form.amenities.length === 0 || Boolean(propertyId && !isDirty)} type="submit">
                {saving ? "Saving…" : propertyId ? "Save changes" : "Save property"}
              </button>
            </div>}
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
        <section className="landlord-submission-panel">
          <div><p className="eyebrow">Listing progression</p><strong>Draft → Hira review → Active or rejected</strong><span>Submission does not make the listing immediately live.</span></div>
        <button
          className="button"
          disabled={photoBusy || property.photos.length < 3}
          onClick={() => void submitForReview()}
          type="button"
        >
          Submit for review
        </button>
        </section>
      )}
      {saved && !propertyId && (
        <Link
          className="button button-outline"
          href={`/account/properties/${saved.id}/edit`}
        >
          Add photos to this property
        </Link>
      )}
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

  async function pauseToEdit() {
    if (!propertyId || property?.status !== "ACTIVE") return;
    setPausing(true);
    setPauseError("");
    try {
      const updated = await apiRequest<LandlordProperty>(
        `/properties/${propertyId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "PAUSED" }),
        },
      );
      const authoritativeForm = toForm(updated);
      setProperty(updated);
      setForm(authoritativeForm);
      setInitialForm(authoritativeForm);
      setPauseConfirmationOpen(false);
    } catch (reason) {
      setPauseError(
        reason instanceof Error ? reason.message : "Listing could not be paused.",
      );
    } finally {
      setPausing(false);
    }
  }
}

function LifecycleState({ property }: { property: LandlordProperty }) {
  const content = {
    DRAFT: ["Draft listing", "Editable and not visible to students. Add at least three photos before submitting for review."],
    PENDING_REVIEW: ["Awaiting Hira review", "Details and photos are locked while the Hira team reviews this listing."],
    ACTIVE: ["Live on Hira", "This listing is currently visible to students. Pause it before changing property details."],
    REJECTED: ["Changes required", "Review the feedback, correct the listing, and resubmit it for approval."],
    PAUSED: ["Listing paused", "This listing is not currently visible to students, but remains editable."],
    INACTIVE: ["Listing inactive", "This listing is not currently live on Hira."],
  }[property.status];
  return (
    <section className={`landlord-lifecycle-state landlord-lifecycle-${property.status.toLowerCase()}`} aria-labelledby="listing-state-heading">
      <div>
        <p className="eyebrow">Listing status</p>
        <h2 id="listing-state-heading">{content[0]}</h2>
        <span>{content[1]}</span>
      </div>
      <LandlordStatus status={property.status} />
    </section>
  );
}

function readOnlyExplanation(status: LandlordProperty["status"]): string {
  if (status === "PENDING_REVIEW") {
    return "This listing is currently being reviewed by Hira. Property details cannot be changed while review is in progress.";
  }
  if (status === "ACTIVE") {
    return "Property details and photos remain locked until you pause this listing.";
  }
  return "This listing is inactive and cannot be edited from the landlord workflow.";
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
        <strong className="landlord-photo-readiness">
          {property.photos.length >= 3
            ? "Photo requirement met — ready for submission."
            : `${3 - property.photos.length} more photo${3 - property.photos.length === 1 ? "" : "s"} required before submission.`}
        </strong>
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

function ControlledSelect({ label, value, onChange, placeholder, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function withLegacyOption(options: readonly string[], value: string): readonly string[] {
  return value && !options.includes(value) ? [value, ...options] : options;
}

function withLegacyOptions(options: readonly string[], values: string[]): readonly string[] {
  return [...values.filter((value) => !options.includes(value)), ...options];
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
    amenities: property.amenities,
    area: property.area,
    nearestInstitution: property.nearestInstitution,
    distanceNote: property.distanceNote ?? "",
    fullAddress: property.fullAddress ?? "",
    latitude: property.latitude ?? "",
    longitude: property.longitude ?? "",
  };
}
