"use server";

import { redirect } from "next/navigation";
import { checkAdminPassword, createAdminSession } from "@/lib/admin-auth";
import { requireCurrentStore } from "@/lib/store-context";

export type LoginState = { error?: string };

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
  redirect("/admin");
}
