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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new Error(message ?? "Something went wrong. Please try again.");
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
