import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { logoutAdmin } from "./actions";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/admin">Orders</Link>
          <Link href="/admin/products">Products</Link>
        </nav>
        <form action={logoutAdmin}>
          <button type="submit" className="text-sm text-muted underline">
            Log out
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
