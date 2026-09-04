import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Our Story
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted sm:text-base">
        <p>
          {siteConfig.name} started with a simple idea: gear and apparel
          should be made when you order it — not stockpiled in a warehouse
          hoping someone buys it.
        </p>
        <p>
          Every design is printed on demand, so nothing goes to waste and
          every order is made just for you. We partner with quality
          print-on-demand manufacturers to keep production close to where
          you live, and to keep our footprint small.
        </p>
        <p>
          {siteConfig.tagline} That&apos;s the whole philosophy — take it
          slow, enjoy the process, and gear up for it in something you
          actually love wearing.
        </p>
      </div>
    </div>
  );
}
