import { NextRequest, NextResponse } from "next/server";
import { getExternalApiBaseUrl } from "@/lib/api/externalApiBaseUrl";
import { getExternalApiKey } from "@/lib/api/externalApiAuth";
import {
  buildLookupCurlExamples,
  resolveLookupExampleOrigin,
} from "@/lib/api/lookupApiExample";
import { parseDatasetFromSearchParams } from "@/lib/api/datasetParam";
import { serializeDatasetParam } from "@/packages/shared/contracts/dataset.schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = getExternalApiKey();
  const configuredBaseUrl = getExternalApiBaseUrl() ?? null;
  const params = request.nextUrl.searchParams;
  const phoneMask = params.get("phoneMask") ?? "";
  const dataset = parseDatasetFromSearchParams(params);
  if (dataset instanceof NextResponse) {
    return dataset;
  }
  const datasetParam = serializeDatasetParam(dataset);

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
    apiKey,
    phoneMask,
    datasetParam
  );

  return NextResponse.json({
    configured: true as const,
    baseUrl: configuredBaseUrl ?? origin,
    exactCurl,
    searchCurl,
  });
}
