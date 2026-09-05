import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin Login" };

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-4 py-24 sm:px-6">
      <h1 className="text-xl font-semibold">Admin Login</h1>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
