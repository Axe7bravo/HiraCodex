type FrontendAnalyticsEvents = {
  property_search: {
    area?: string;
    nearestInstitution?: string;
    roomType?: string;
    filtersActive: boolean;
    resultCount: number;
  };
  property_viewed: {
    propertyId: string;
    roomType: string;
    area: string;
  };
};

const anonymousIdKey = "hira_analytics_id";

export function trackAnalytics<Event extends keyof FrontendAnalyticsEvents>(
  event: Event,
  properties: FrontendAnalyticsEvents[Event],
): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!apiKey || !host || typeof window === "undefined") return;

  const body = JSON.stringify({
    api_key: apiKey,
    event,
    properties: {
      distinct_id: anonymousId(),
      ...properties,
    },
  });

  try {
    void fetch(`${host.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics is best-effort and must never affect the user flow.
  }
}

function anonymousId(): string {
  try {
    const existing = window.localStorage.getItem(anonymousIdKey);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(anonymousIdKey, created);
    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}
