"use client";

import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function AppToast({
  message,
  onDismiss,
  durationMs = 5000,
  variant = "success",
}: {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  variant?: "success" | "error";
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg",
        "animate-in fade-in slide-in-from-bottom-2",
        variant === "error"
          ? "border-red-300 bg-red-50 text-red-950"
          : "border-border bg-background text-foreground"
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
