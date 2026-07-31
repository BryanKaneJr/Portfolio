import { NextResponse } from "next/server";

/**
 * Liveness probe. Kept dependency-free so it works even when AI is disabled or
 * the database is degraded (used by CI smoke tests and uptime monitoring).
 */
export function GET() {
  return NextResponse.json({ status: "ok", service: "commander-companion-web" });
}
