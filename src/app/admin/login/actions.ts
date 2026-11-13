"use server";

import { checkAdminPassword, createAdminSession } from "@/lib/admin-auth";
import { requireCurrentStore } from "@/lib/store-context";

export type LoginState = { error?: string; success?: boolean };

export async function adminLogin(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const store = await requireCurrentStore();

  if (!checkAdminPassword(password, store)) {
    return { error: "Incorrect password." };
  }

  await createAdminSession(store);
  // Let the browser make a fresh same-origin request. A Server Action redirect
  // can render /admin through the server's internal origin, losing tenant host
  // context behind a reverse proxy even though the session cookie was saved.
  return { success: true };
}
