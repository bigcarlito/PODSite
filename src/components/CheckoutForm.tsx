"use client";

import { useActionState } from "react";
import { placeOrder, type CheckoutState } from "@/app/checkout/actions";

const initialState: CheckoutState = {};

export function CheckoutForm() {
  const [state, formAction, pending] = useActionState(
    placeOrder,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Contact</legend>
        <Field label="Email" name="email" type="email" required />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Shipping address</legend>
        <Field label="Full name" name="name" required />
        <Field label="Address" name="address1" required />
        <Field label="Apartment, suite, etc. (optional)" name="address2" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" name="city" required />
          <Field label="State" name="state" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="ZIP code" name="zip" required />
          <Field label="Country" name="country" defaultValue="US" required />
        </div>
      </fieldset>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <p className="rounded-xl bg-accent/10 p-4 text-xs text-muted">
        Payment collection isn&apos;t enabled yet — placing this order will
        record it for fulfillment without charging a card.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50 sm:text-base"
      >
        {pending ? "Placing order..." : "Place Order"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
