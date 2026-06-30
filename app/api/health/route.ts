import { NextResponse } from "next/server";
import { pool } from "@/packages/db";

export async function GET() {
  let client;
  try {
    client = await pool().connect();
    await client.query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      database: "ok",
      version: process.env.APP_VERSION ?? "unknown",
      revision: process.env.APP_REVISION ?? "unknown",
    });
  } catch (error) {
    console.error("health GET error:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "down",
        message:
          process.env.NODE_ENV === "production"
            ? "Database unavailable"
            : error instanceof Error
              ? error.message
              : "Internal server error",
      },
      { status: 503 }
    );
  } finally {
    client?.release();
  }
}
