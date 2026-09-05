"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";

export function MobileNav({
  nav,
}: {
  nav: { label: string; href: string }[];
}) {
  // `open` can only become true from a click, which only happens after
  // hydration, so no SSR/client mismatch guard is needed for the portal.
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center -ml-2"
      >
        <span className="relative block h-4 w-6">
          <span
            className={`absolute left-0 top-0 h-0.5 w-6 bg-foreground transition-transform ${
              open ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`absolute left-0 top-[7px] h-0.5 w-6 bg-foreground transition-opacity ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 top-[14px] h-0.5 w-6 bg-foreground transition-transform ${
              open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-background border-t border-border">
              <nav className="flex flex-col p-4">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="border-b border-border py-4 text-lg"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/search"
                  onClick={() => setOpen(false)}
                  className="py-4 text-lg"
                >
                  Search
                </Link>
              </nav>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
