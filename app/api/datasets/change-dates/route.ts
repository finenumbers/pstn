import { NextResponse } from "next/server";
import { listChangeDatesResponse } from "@/packages/db/queries/datasetsQueries";
import { internalServerError } from "@/lib/api/errors";

export async function GET() {
  try {
    const response = await listChangeDatesResponse();
    return NextResponse.json(response);
  } catch (error) {
    return internalServerError(error);
  }
}
