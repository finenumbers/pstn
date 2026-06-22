import { NextResponse } from "next/server";
import { getExternalApiBaseUrl } from "@/lib/api/externalApiBaseUrl";
import { getExternalApiKey } from "@/lib/api/externalApiAuth";

export const dynamic = "force-dynamic";

/** Lookup availability for UI — does not expose the API key (use /examples for curl). */
export async function GET() {
  const configured = Boolean(getExternalApiKey());
  const baseUrl = getExternalApiBaseUrl() ?? null;

  if (!configured) {
    return NextResponse.json(
      { configured: false as const, baseUrl },
      { status: 503 }
    );
  }

  return NextResponse.json({
    configured: true as const,
    baseUrl,
  });
}
