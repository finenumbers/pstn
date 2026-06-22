import { NextRequest, NextResponse } from "next/server";
import { getExternalApiBaseUrl } from "@/lib/api/externalApiBaseUrl";
import { getExternalApiKey } from "@/lib/api/externalApiAuth";
import {
  buildLookupCurlExamples,
  LOOKUP_CURL_API_KEY_PLACEHOLDER,
  resolveLookupExampleOrigin,
} from "@/lib/api/lookupApiExample";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = getExternalApiKey();
  const configuredBaseUrl = getExternalApiBaseUrl() ?? null;
  const phoneMask = request.nextUrl.searchParams.get("phoneMask") ?? "";

  if (!apiKey) {
    return NextResponse.json(
      { configured: false as const, baseUrl: configuredBaseUrl },
      { status: 503 }
    );
  }

  const origin = resolveLookupExampleOrigin(
    request,
    configuredBaseUrl ?? undefined
  );
  if (!origin) {
    return NextResponse.json(
      {
        configured: false as const,
        baseUrl: configuredBaseUrl,
        message: "Cannot resolve API base URL",
      },
      { status: 503 }
    );
  }

  const { exactCurl, searchCurl } = buildLookupCurlExamples(
    origin,
    LOOKUP_CURL_API_KEY_PLACEHOLDER,
    phoneMask
  );

  return NextResponse.json({
    configured: true as const,
    baseUrl: configuredBaseUrl ?? origin,
    exactCurl,
    searchCurl,
  });
}
