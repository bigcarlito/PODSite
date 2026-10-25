"use client";

import { useActionState, useEffect } from "react";
import { adminLogin, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    adminLogin,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      window.location.assign(new URL("/admin", window.location.origin).href);
    }
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Admin password</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-muted">
          Signed in. <a href="/admin" className="underline">Continue to admin</a>.
        </p>
      )}
      <button
        type="submit"
        disabled={pending || state.success}
        className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
      >
        {pending || state.success ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
