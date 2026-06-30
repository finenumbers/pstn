import { NextResponse } from "next/server";
import {
  formatDatabaseBytes,
  getDatabaseStorageBytes,
} from "@/packages/db/queries/datasetsQueries";
import { internalServerError } from "@/lib/api/errors";

export async function GET() {
  try {
    const databaseBytes = await getDatabaseStorageBytes();
    return NextResponse.json({
      databaseBytes,
      formatted: formatDatabaseBytes(databaseBytes),
    });
  } catch (error) {
    return internalServerError(error);
  }
}
