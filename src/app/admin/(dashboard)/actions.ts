"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyAdminSession } from "@/lib/admin-auth";
import { requireCurrentStore } from "@/lib/store-context";
import * as ordersStore from "@/lib/store/orders";

export async function logoutAdmin() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function submitOrderToFulfillment(orderId: string) {
  const store = await requireCurrentStore();
  await ordersStore.submitOrderToFulfillment(store, orderId, "admin");
  revalidatePath("/admin");
}

export async function markOrderPaid(orderId: string) {
  const store = await requireCurrentStore();
  await ordersStore.markOrderPaid(store.id, orderId, "admin");
  revalidatePath("/admin");
}
