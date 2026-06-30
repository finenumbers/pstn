"use client";

import { useEffect, useState } from "react";

type HealthPayload = {
  version?: string;
  revision?: string;
};

export function AppVersionBadge() {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload && typeof payload === "object") {
          setHealth(payload as HealthPayload);
        }
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health?.version || health.version === "unknown") {
    return null;
  }

  const revision =
    health.revision && health.revision !== "unknown"
      ? health.revision.slice(0, 7)
      : null;

  return (
    <p className="text-xs text-muted-foreground">
      Версия {health.version}
      {revision ? ` · ${revision}` : ""}
    </p>
  );
}
