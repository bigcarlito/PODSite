import { notFound } from "next/navigation";
import type { Metadata } from "next";

const policies: Record<string, { title: string; body: string }> = {
  shipping: {
    title: "Shipping Policy",
    body: `All items are printed on demand and typically ship within 2-7 business days.

Domestic orders arrive in 5-8 business days after production. International orders may take 10-20 business days depending on destination.

You'll receive a tracking link by email as soon as your order ships.`,
  },
  returns: {
    title: "Returns & Exchanges",
    body: `We want you to love what you ordered. If something isn't right, reach out within 30 days of delivery and we'll make it right with a replacement or refund.

Because every item is printed on demand specifically for you, we're unable to accept returns for reasons other than a defect or printing error.`,
  },
  "size-guide": {
    title: "Size Guide",
    body: `Our apparel fits true to size. If you're between sizes, we recommend sizing up for a relaxed fit.

A detailed size chart (chest, length, sleeve) is available on each product page.`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `We collect only the information needed to process your order: name, email, shipping address, and order details.

We never sell your personal information. Payment information is processed securely and is never stored on our servers.`,
  },
  terms: {
    title: "Terms of Service",
    body: `By placing an order, you agree to provide accurate shipping and contact information and to pay the listed price for any items ordered.

All designs and site content are the property of the store and may not be reproduced without permission.`,
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: policies[slug]?.title ?? "Policy" };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = policies[slug];
  if (!policy) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {policy.title}
      </h1>
      <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted sm:text-base">
        {policy.body}
      </div>
    </div>
  );
}
