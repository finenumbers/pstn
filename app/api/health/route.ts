import { NextResponse } from "next/server";
import { pool } from "@/packages/db";
import os from "os";

export async function GET() {
  const deployInfo = {
    version: process.env.APP_VERSION ?? "unknown",
    revision: process.env.APP_REVISION ?? "unknown",
    hostname: os.hostname(),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    uptimeSec: Math.round(process.uptime()),
  };

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
