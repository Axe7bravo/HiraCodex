"use client";

import Link from "next/link";
import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { apiRequest, LandlordProperty } from "@/lib/api";

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

  useEffect(() => {
    if (!propertyId) return;
    apiRequest<LandlordProperty[]>("/properties/mine")
      .then((properties) => {
        const property = properties.find(({ id }) => id === propertyId);
        if (!property) throw new Error("Property not found.");
        setForm(toForm(property));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

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
      setSaved(
        await apiRequest<LandlordProperty>(
          propertyId ? `/properties/${propertyId}` : "/properties",
          {
            method: propertyId ? "PATCH" : "POST",
            body: JSON.stringify(body),
          },
        ),
      );
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
          Save complete listing details as a draft. Photo uploads and review
          submission are not part of this step.
        </p>
      </div>
      {error && !form.title && propertyId ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        <form className="auth-form property-form" onSubmit={submit}>
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
              Property saved as{" "}
              {saved.status === "PAUSED" ? "paused" : "a draft"}.
            </p>
          )}
          <button className="button" disabled={saving} type="submit">
            {saving ? "Saving property…" : "Save property"}
          </button>
        </form>
      )}
      <Link href="/account/properties">Back to properties</Link>
    </section>
  );
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
