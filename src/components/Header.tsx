import Link from "next/link";
import { getCart, cartItemCount } from "@/lib/cart";
import { getCurrentStore } from "@/lib/store-context";
import { getStoreBranding } from "@/lib/store-branding";
import { MobileNav } from "./MobileNav";

export async function Header() {
  const store = await getCurrentStore();

  if (!store) {
    return (
      <header className="sticky top-0 z-50 border-b border-border bg-background/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight">
            Store not found
          </span>
        </div>
      </header>
    );
  }

  const branding = getStoreBranding(store);
  const cart = await getCart(store.id);
  const count = cart ? cartItemCount(cart.items) : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <MobileNav nav={branding.nav} />
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight sm:text-xl"
          >
            {branding.name}
          </Link>
        </div>

        <nav className="hidden md:flex md:items-center md:gap-8">
          {branding.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/search"
            aria-label="Search"
            className="hidden h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-black/5 sm:flex"
          >
            <SearchIcon />
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-black/5"
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="h-5 w-5"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="h-5 w-5"
    >
      <path
        d="M6 8h12l-1 12H7L6 8Z"
        strokeLinejoin="round"
      />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  );
}
