import { NextRequest, NextResponse } from "next/server";
import { getPricingTable } from "@/lib/ai/pricing";
import { readUsageRecords } from "@/lib/ai/usage/store";
import { summarizeUsage } from "@/lib/ai/usage/summary";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "dylandevaux3@gmail.com";
const RECENT_LIMIT = 100;

export const dynamic = "force-dynamic";

/** Same email check as the other admin routes, sent in a header so it stays out of URLs and logs. */
export async function GET(req: NextRequest) {
  const email = req.headers.get("x-admin-email")?.trim().toLowerCase();
  if (!email || email !== ADMIN_EMAIL.trim().toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tz = Number(req.nextUrl.searchParams.get("tz"));
  const tzOffsetMinutes = Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0;

  const records = await readUsageRecords();
  return NextResponse.json({
    summary: summarizeUsage(records, new Date(), tzOffsetMinutes),
    recent: records.slice(-RECENT_LIMIT).reverse(),
    pricing: getPricingTable(),
  });
}
