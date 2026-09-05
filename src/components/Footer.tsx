import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Newsletter } from "./Newsletter";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <p className="text-lg font-semibold">{siteConfig.shortName}</p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              {siteConfig.description}
            </p>
            <div className="mt-4">
              <p className="text-sm font-medium">
                Join the club for 10% off your first order
              </p>
              <div className="mt-3">
                <Newsletter />
              </div>
            </div>
          </div>

          {Object.entries(siteConfig.footerLinks).map(([title, links]) => (
            <div key={title}>
              <p className="text-sm font-semibold">{title}</p>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col-reverse items-center gap-4 border-t border-border pt-6 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} {siteConfig.name}. All rights
            reserved.
          </p>
          <div className="flex gap-4">
            {siteConfig.social.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
