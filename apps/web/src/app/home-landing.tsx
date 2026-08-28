"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  CheckCircle2,
  Home,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  apiRequest,
  apiUrl,
  type DiscoveryPage,
  type DiscoveryProperty,
} from "@/lib/api";
import {
  discoveryAmenities,
  discoveryAreas,
  discoveryInstitutions,
  discoveryRoomTypes,
} from "./properties/discovery-options";

export function HomeLanding() {
  const [listings, setListings] = useState<DiscoveryProperty[] | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    let current = true;
    apiRequest<DiscoveryPage>(
      "/discovery/properties?page=1&pageSize=6&sort=newest",
    )
      .then((result) => {
        if (current) setListings(result.items);
      })
      .catch(() => {
        if (!current) return;
        setPreviewFailed(true);
        setListings([]);
      });
    return () => {
      current = false;
    };
  }, []);

  return (
    <>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker">
            <Home aria-hidden="true" /> Student housing marketplace in Lesotho
          </p>
          <h1 id="landing-title">
            Find trusted <span>student housing</span> in Maseru<span>.</span>
          </h1>
          <p className="landing-lead">
            Browse approved accommodation, compare the details that matter,
            and connect directly with verified landlords.
          </p>
        </div>

        <div className="landing-hero-art" aria-label="Student housing in Maseru">
          <div className="landing-hero-blue" aria-hidden="true" />
          <div className="landing-hero-photo">
            <Image
              src="/images/hira-students-maseru.png"
              alt="Two students walking together near accommodation in Maseru"
              fill
              sizes="(max-width: 760px) 92vw, 48vw"
              priority
            />
          </div>
          <div className="landing-trust-card">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>Approved listings</strong>
              <span>Reviewed before they appear in discovery.</span>
            </div>
          </div>
        </div>

        <form className="landing-search" action="/properties" method="get">
          <label>
            <MapPin aria-hidden="true" />
            <span>
              <small>Location</small>
              <select name="area" aria-label="Area in Maseru" defaultValue="">
                <option value="">Any area</option>
                {discoveryAreas.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </span>
          </label>
          <label><span><small>Maximum budget</small><input name="maxPrice" type="number" min="1" step="1" placeholder="Any budget" /></span></label>
          <label><BedDouble aria-hidden="true" /><span><small>Room type</small><select name="roomType" defaultValue=""><option value="">Any type</option>{discoveryRoomTypes.map((roomType) => <option key={roomType} value={roomType}>{roomType}</option>)}</select></span></label>
          <label><span><small>Move-in</small><input name="availableBy" type="date" /></span></label>
          <label><Building2 aria-hidden="true" /><span><small>Nearest institution</small><select name="nearestInstitution" defaultValue=""><option value="">Any institution</option>{discoveryInstitutions.map((institution) => <option key={institution} value={institution}>{institution}</option>)}</select></span></label>
          <label><SlidersHorizontal aria-hidden="true" /><span><small>Amenity</small><select name="amenities" defaultValue=""><option value="">Any amenity</option>{discoveryAmenities.map((amenity) => <option key={amenity} value={amenity}>{amenity}</option>)}</select></span></label>
          <button type="submit">
            <Search aria-hidden="true" /> Search rooms
          </button>
        </form>
      </section>

      <section className="landing-section landing-listings" aria-labelledby="homes-title">
        <div className="landing-section-heading">
          <div>
            <p className="eyebrow">Homes in Maseru</p>
            <h2 id="homes-title">A clearer way to find your next room.</h2>
          </div>
          <Link href="/properties">View all homes <ArrowRight aria-hidden="true" /></Link>
        </div>

        {listings === null ? (
          <div className="landing-property-grid" aria-label="Loading homes">
            {Array.from({ length: 6 }, (_, index) => <div className="landing-property-skeleton" key={index} />)}
          </div>
        ) : listings.length > 0 ? (
          <div className="landing-property-grid">
            {listings.map((property) => <LandingPropertyCard property={property} key={property.id} />)}
          </div>
        ) : (
          <div className="landing-preview-empty">
            <Home aria-hidden="true" />
            <div>
              <h3>{previewFailed ? "Homes could not be loaded." : "More homes are coming soon."}</h3>
              <p>Visit discovery to browse the latest approved accommodation.</p>
            </div>
            <Link href="/properties">Open property discovery</Link>
          </div>
        )}
      </section>

      <div className="landing-information-grid">
        <section className="landing-trust" aria-labelledby="trust-title">
          <p className="eyebrow">Trust built into the journey</p>
          <h2 id="trust-title">Why students trust Hira</h2>
          <div className="landing-trust-grid">
            <TrustItem icon={<BadgeCheck aria-hidden="true" />} title="Verified landlords" copy="Landlord verification is shown from real review status." />
            <TrustItem icon={<CheckCircle2 aria-hidden="true" />} title="Approved accommodation" copy="Only ACTIVE listings approved for discovery are shown publicly." />
            <TrustItem icon={<BedDouble aria-hidden="true" />} title="Student-focused details" copy="Compare room type, price, amenities and availability clearly." />
            <TrustItem icon={<MessageSquareText aria-hidden="true" />} title="Structured connection" copy="Send an inquiry or accommodation request without realtime chat." />
          </div>
        </section>

        <section className="landing-how" id="how-hira-works" aria-labelledby="how-title">
        <div className="landing-section-heading">
          <div><p className="eyebrow">Simple from search to connection</p><h2 id="how-title">How Hira works</h2></div>
        </div>
        <ol className="landing-steps">
          <li><span>1</span><div><strong>Discover</strong><p>Browse student accommodation across Maseru.</p></div></li>
          <li><span>2</span><div><strong>Compare</strong><p>Review price, room type, amenities, availability and location context.</p></div></li>
          <li><span>3</span><div><strong>Connect</strong><p>Send an inquiry or accommodation request to the landlord.</p></div></li>
        </ol>
        </section>
      </div>

      <section className="landing-landlord">
        <div>
          <Building2 aria-hidden="true" />
          <div><p>For landlords in Maseru</p><h2>Reach students with a clear, structured property listing.</h2><span>Create your profile, complete verification and prepare your property for review.</span></div>
        </div>
        <Link href="/register">Create landlord account <ArrowRight aria-hidden="true" /></Link>
      </section>
    </>
  );
}

function LandingPropertyCard({ property }: { property: DiscoveryProperty }) {
  const [imageFailed, setImageFailed] = useState(false);
  const photo = property.photos[0];
  const price = new Intl.NumberFormat("en-LS", { style: "currency", currency: "LSL", maximumFractionDigits: 0 }).format(Number(property.monthlyPrice));
  return (
    <article className="marketplace-card landing-property-card">
      <Link className="marketplace-card-image" href={`/properties/${property.id}`}>
        {photo && !imageFailed ? <Image src={photoUrl(property, photo.id)} alt={`${property.title} listing`} fill sizes="(max-width: 680px) 88vw, (max-width: 1000px) 44vw, 23vw" unoptimized onError={() => setImageFailed(true)} /> : <span className="marketplace-image-fallback" role="img" aria-label="Property image unavailable"><Home aria-hidden="true" /> Image unavailable</span>}
      </Link>
      <div className="marketplace-card-body">
        <h2><Link href={`/properties/${property.id}`}>{property.title}</Link></h2>
        <p className="marketplace-card-location"><MapPin aria-hidden="true" /><span>{property.area}, {property.city}</span></p>
        <p className="marketplace-card-price">{price}<span> / month</span></p>
        <p className="marketplace-card-room">{property.roomType}</p>
        <ul className="marketplace-amenities">{property.amenities.slice(0, 3).map((amenity) => <li key={amenity}>{amenity}</li>)}</ul>
      </div>
      <div className="marketplace-card-footer"><ShieldCheck aria-hidden="true" /><span>Approved listing</span></div>
    </article>
  );
}

function TrustItem({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <article>{icon}<div><h3>{title}</h3><p>{copy}</p></div></article>;
}

function photoUrl(property: DiscoveryProperty, photoId: string) {
  return `${apiUrl}/discovery/properties/${property.id}/photos/${photoId}`;
}
