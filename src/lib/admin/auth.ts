import type { NextRequest } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "dylandevaux3@gmail.com";

/** Same email check as the other admin routes, read from a header so it stays out of URLs and logs. */
export function isAdminRequest(req: NextRequest): boolean {
  const email = req.headers.get("x-admin-email")?.trim().toLowerCase();
  return !!email && email === ADMIN_EMAIL.trim().toLowerCase();
}
