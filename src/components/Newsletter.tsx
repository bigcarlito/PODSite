"use client";

import { useState } from "react";

export function Newsletter() {
  const [status, setStatus] = useState<"idle" | "submitted">("idle");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setStatus("submitted");
      }}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
    >
      <input
        type="email"
        required
        placeholder="Your email address"
        className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
      >
        {status === "submitted" ? "Thanks!" : "Subscribe"}
      </button>
    </form>
  );
}
