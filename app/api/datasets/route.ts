import { NextResponse } from "next/server";
import { listDatasetItems } from "@/packages/db/queries/datasetsQueries";
import type { DatasetsResponse } from "@/packages/shared/contracts/dataset.schema";
import { internalServerError } from "@/lib/api/errors";

export async function GET() {
  try {
    const items = await listDatasetItems();
    const response: DatasetsResponse = { items };
    return NextResponse.json(response);
  } catch (error) {
    return internalServerError(error);
  }
}
