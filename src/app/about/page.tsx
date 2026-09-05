import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/store-context";
import { getStoreBranding } from "@/lib/store-branding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "About Us" };

export default async function AboutPage() {
  const store = await getCurrentStore();
  if (!store) notFound();
  const branding = getStoreBranding(store);

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Our Story
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted sm:text-base">
        <p>
          {branding.name} started with a simple idea: designs should be made
          when you order them — not stockpiled in a warehouse hoping someone
          buys them.
        </p>
        <p>
          Every design is printed on demand, so nothing goes to waste and
          every order is made just for you. We partner with quality
          print-on-demand manufacturers to keep production close to where
          you live, and to keep our footprint small.
        </p>
        <p>
          {branding.tagline} That&apos;s the whole philosophy — take it
          slow, enjoy the process, and get something you actually love.
        </p>
      </div>
    </div>
  );
}
