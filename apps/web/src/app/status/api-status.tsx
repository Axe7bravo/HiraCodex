"use client";

import { useEffect, useState } from "react";

type HealthResponse = { status: "ok"; api: "running"; database: "reachable" };
type RequestState =
  | { kind: "loading" }
  | { kind: "success"; health: HealthResponse }
  | { kind: "failure"; message: string };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function ApiStatus() {
  const [requestState, setRequestState] = useState<RequestState>({
    kind: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    async function checkHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Health request failed");
        setRequestState({
          kind: "success",
          health: (await response.json()) as HealthResponse,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setRequestState({
          kind: "failure",
          message: "Could not reach the API and database health check.",
        });
      }
    }
    void checkHealth();
    return () => controller.abort();
  }, []);

  if (requestState.kind === "loading")
    return <p className="state state-loading">Checking services…</p>;
  if (requestState.kind === "failure")
    return (
      <div className="state state-failure" role="alert">
        <strong>Connection failed</strong>
        <span>{requestState.message}</span>
      </div>
    );
  return (
    <div className="state state-success" role="status">
      <strong>All systems connected</strong>
      <dl>
        <div>
          <dt>NestJS API</dt>
          <dd>{requestState.health.api}</dd>
        </div>
        <div>
          <dt>PostgreSQL via Prisma</dt>
          <dd>{requestState.health.database}</dd>
        </div>
      </dl>
    </div>
  );
}
