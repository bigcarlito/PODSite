import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/store-context";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin Login" };

export default async function AdminLoginPage() {
  const store = await getCurrentStore();
  if (!store) notFound();

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-4 py-24 sm:px-6">
      <h1 className="text-xl font-semibold">{store.name} — Admin Login</h1>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
