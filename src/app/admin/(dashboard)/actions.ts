"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyAdminSession } from "@/lib/admin-auth";
import * as ordersStore from "@/lib/store/orders";

export async function logoutAdmin() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function submitOrderToFulfillment(orderId: string) {
  await ordersStore.submitOrderToFulfillment(orderId);
  revalidatePath("/admin");
}

export async function markOrderPaid(orderId: string) {
  await ordersStore.markOrderPaid(orderId);
  revalidatePath("/admin");
}
