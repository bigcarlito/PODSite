import { test } from "node:test";
import assert from "node:assert/strict";
import { storefrontSchema, getCommercePolicy, isManualFulfillment } from "../src/lib/storefront-theme";
import { matchesPaidOrder } from "../src/lib/payments/checkout-validation";

test("artwork supports mobile sources and bounds decorative overlays", () => {
  assert.equal(storefrontSchema.safeParse({ hero: { src: "/api/assets/hero", mobileSrc: "https://example.com/mobile.png", alt: "Dog" } }).success, true);
  for (const src of ["javascript:alert(1)", "//untrusted.example/a", "/\\evil"]) assert.equal(storefrontSchema.safeParse({ hero: { src } }).success, false);
  assert.equal(storefrontSchema.safeParse({ decorations: [{ src: "/dog.png", side: "right", widthPercent: 80, bottomPercent: 0 }] }).success, false);
});
test("tenant isolation checks: launch policy does not alter Bird Nerd", () => {
  for (const slug of ["shihtshirts", "shihttshirts"]) {
    assert.equal(getCommercePolicy({ slug, theme: null }).checkoutEnabled, false);
    assert.equal(isManualFulfillment({ slug, theme: null }), true);
  }
  assert.equal(getCommercePolicy({ slug: "bird-nerd", theme: null }).checkoutEnabled, true);
  assert.equal(isManualFulfillment({ slug: "bird-nerd", theme: null }), false);
  assert.equal(getCommercePolicy({ slug: "bird-nerd", theme: { commerce: { checkoutEnabled: false, fulfillmentMode: "manual" } } }).checkoutEnabled, false);
  assert.equal(getCommercePolicy({ slug: "shihtshirts", theme: { commerce: "bad" } }).checkoutEnabled, false);
});
test("paid order validation rejects unpaid, wrong tenant, wrong order, currency and amount", () => {
  const order = { id: "order-a", storeId: "store-a", currency: "USD", subtotalCents: 3000, shippingCents: 500 };
  const session = { payment_status: "paid", currency: "usd", amount_total: 3500, metadata: { orderId: order.id, storeId: order.storeId } };
  assert.equal(matchesPaidOrder(session, order), true);
  for (const patch of [{ payment_status: "unpaid" }, { currency: "eur" }, { amount_total: 3000 }, { metadata: { storeId: "store-b", orderId: order.id } }, { metadata: { storeId: order.storeId, orderId: "other" } }]) assert.equal(matchesPaidOrder({ ...session, ...patch }, order), false);
});
