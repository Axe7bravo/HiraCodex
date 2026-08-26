export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "TENANT" | "LANDLORD" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
};

type CommonProfile = SafeUser & {
  phone: string | null;
  contactMethod: string | null;
};

export type UserProfile =
  | (CommonProfile & {
      role: "TENANT";
      verificationStatus: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
      tenantProfile: {
        institution: string | null;
        expectedMoveIn: string | null;
      };
    })
  | (CommonProfile & {
      role: "LANDLORD";
      verificationStatus: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
      landlordProfile: {
        organisation: string | null;
        propertyCount: number | null;
      };
    })
  | (CommonProfile & { role: "ADMIN" });

export type VerificationDocument = {
  id: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type VerificationSubmission = {
  id: string | null;
  type: "STUDENT" | "LANDLORD";
  status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  documents: VerificationDocument[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type AdminVerificationOwner = Pick<
  SafeUser,
  "id" | "firstName" | "lastName" | "email" | "role"
> & {
  tenantProfile: { institution: string | null } | null;
  landlordProfile: { organisation: string | null } | null;
};

export type AdminVerificationQueueItem = {
  id: string;
  type: "STUDENT" | "LANDLORD";
  status: "PENDING";
  createdAt: string;
  user: AdminVerificationOwner;
  documentCount: number;
};

export type AdminVerificationDetail = Omit<
  VerificationSubmission,
  "id" | "status"
> & {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  user: AdminVerificationOwner;
  reviewedBy: Pick<SafeUser, "id" | "firstName" | "lastName" | "email"> | null;
};

export type PropertyStatus =
  "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "PAUSED" | "INACTIVE";

export type LandlordProperty = {
  id: string;
  landlordId: string;
  title: string;
  description: string;
  monthlyPrice: string;
  roomType: string;
  status: PropertyStatus;
  availableFrom: string;
  amenities: string[];
  country: string;
  city: string;
  area: string;
  nearestInstitution: string;
  distanceNote: string | null;
  fullAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  photos: PropertyPhoto[];
};

export type PropertyPhoto = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  createdAt: string;
};

export type AdminPropertyLandlord = Pick<
  SafeUser,
  "id" | "firstName" | "lastName" | "email"
> & {
  phone: string | null;
  contactMethod: string | null;
  landlordProfile: {
    organisation: string | null;
    propertyCount: number | null;
  } | null;
};

export type AdminPropertyQueueItem = {
  id: string;
  title: string;
  monthlyPrice: string;
  status: "PENDING_REVIEW";
  country: string;
  city: string;
  area: string;
  submittedAt: string;
  photoCount: number;
  landlord: AdminPropertyLandlord;
};

export type AdminPropertyDetail = LandlordProperty & {
  landlord: AdminPropertyLandlord;
  review: {
    action: "PROPERTY_APPROVED" | "PROPERTY_REJECTED";
    createdAt: string;
    actor: Pick<SafeUser, "id" | "firstName" | "lastName" | "email">;
  } | null;
};

export type DiscoveryProperty = {
  id: string;
  title: string;
  monthlyPrice: string;
  roomType: string;
  availableFrom: string;
  amenities: string[];
  country: string;
  city: string;
  area: string;
  nearestInstitution: string;
  distanceNote: string | null;
  createdAt: string;
  photos: Pick<PropertyPhoto, "id" | "mimeType" | "sortOrder">[];
};

export type DiscoveryPage = {
  items: DiscoveryProperty[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PublicPropertyDetail = Omit<DiscoveryProperty, "photos"> & {
  description: string;
  updatedAt: string;
  photos: Pick<PropertyPhoto, "id" | "mimeType" | "sortOrder">[];
  landlord: {
    firstName: string;
    lastName: string;
    organisation: string | null;
    verified: boolean;
  };
};

export type FavouriteItem = {
  propertyId: string;
  createdAt: string;
  property: DiscoveryProperty;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: isFormData
      ? options.headers
      : { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new ApiError(
      message ?? "Something went wrong. Please try again.",
      response.status,
    );
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
