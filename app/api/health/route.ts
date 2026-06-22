import { NextResponse } from "next/server";
import { pool } from "@/packages/db";

export async function GET() {
  try {
    const client = await pool().connect();
    await client.query("SELECT 1");
    client.release();
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("health GET error:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "down",
        message:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 503 }
    );
  }
}
