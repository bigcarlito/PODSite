import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Contact Us
      </h1>
      <p className="mt-3 text-sm text-muted sm:text-base">
        Questions about an order, sizing, or anything else? Send us a message
        and we&apos;ll get back to you within one business day.
      </p>

      <form className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Name</span>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Message</span>
          <textarea
            name="message"
            required
            rows={5}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-white hover:bg-accent-dark sm:w-auto sm:px-8"
        >
          Send Message
        </button>
      </form>
    </div>
  );
}
