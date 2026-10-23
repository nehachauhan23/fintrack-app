import { NextResponse } from "next/server";
import { requireUserOrThrow } from "@/server/auth/dal";
import { rateLimitOrThrow } from "@/server/auth/rate-limit";
import { exportUserData } from "@/server/services/auth";
import { audit } from "@/server/audit";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** A complete copy of the user's data (credentials and session tokens excluded). */
export async function GET() {
  try {
    const user = await requireUserOrThrow();
    await rateLimitOrThrow(`export-data:${user.id}`, { limit: 3, windowSec: 3600 });
    const data = await exportUserData(user.id);
    await audit("data.export", { userId: user.id });
    return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="fintrack-export.json"`, "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
