import { NextResponse } from "next/server";
import { pool } from "@/packages/db";
import os from "os";

function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>
): void {
  // #region agent log
  fetch("http://127.0.0.1:7812/ingest/db1027e1-b60b-480f-a94e-2c390e7035f8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "bcdc45",
    },
    body: JSON.stringify({
      sessionId: "bcdc45",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export async function GET() {
  const deployInfo = {
    version: process.env.APP_VERSION ?? "unknown",
    revision: process.env.APP_REVISION ?? "unknown",
    hostname: os.hostname(),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    uptimeSec: Math.round(process.uptime()),
  };

  // #region agent log
  debugLog("H1", "health/route.ts:GET", "health deploy snapshot", deployInfo);
  // #endregion

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
