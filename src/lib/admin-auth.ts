import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { verifyPassword } from "@/lib/credentials";
import type { Store } from "@prisma/client";

const COOKIE_NAME = "admin_session";

/**
 * Session token is derived from this store's own password hash (not just
 * its id), so changing a store's password invalidates existing sessions —
 * and from a global secret, so a session can't be forged without it.
 */
function expectedToken(store: Store): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "dev-secret";
  return createHmac("sha256", secret)
    .update(`${store.id}:${store.adminPasswordHash}`)
    .digest("hex");
}

export function checkAdminPassword(password: string, store: Store): boolean {
  return verifyPassword(password, store.adminPasswordHash);
}

export async function createAdminSession(store: Store) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, expectedToken(store), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated(store: Store): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = expectedToken(store);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
