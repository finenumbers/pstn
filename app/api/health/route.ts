import { NextResponse } from "next/server";
import { pool } from "@/packages/db";

function isHealthVerbose(): boolean {
  return (
    process.env.HEALTH_VERBOSE === "1" || process.env.NODE_ENV !== "production"
  );
}

export async function GET() {
  const verbose = isHealthVerbose();
  const deployInfo = verbose
    ? {
        version: process.env.APP_VERSION ?? "unknown",
        revision: process.env.APP_REVISION ?? "unknown",
        nodeEnv: process.env.NODE_ENV ?? "unknown",
        uptimeSec: Math.round(process.uptime()),
      }
    : undefined;

  let client;
  try {
    client = await pool().connect();
    await client.query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      database: "ok",
      ...deployInfo,
    });
  } catch (error) {
    console.error("health GET error:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "down",
        ...deployInfo,
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
