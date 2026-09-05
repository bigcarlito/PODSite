export type FulfillmentProviderName = "PRINTFUL" | "PRINTIFY" | "GELATO";

export interface CatalogVariant {
  providerVariantId: string;
  name: string;
  size?: string;
  color?: string;
  costCents: number;
  currency: string;
}

export interface CatalogProduct {
  providerProductId: string;
  name: string;
  variants: CatalogVariant[];
}

export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface FulfillmentOrderItem {
  providerVariantId: string;
  quantity: number;
}

export interface FulfillmentOrderResult {
  providerOrderId: string;
  status: string;
}

export interface VariantQuote {
  providerVariantId: string;
  costCents: number;
  shippingCents: number;
  currency: string;
}

/**
 * Common interface every print-on-demand fulfillment integration implements.
 * Adding a new provider (Gelato, Printify, ...) means implementing this
 * interface and registering it in `registry.ts` — nothing else in the app
 * (cart, checkout, orders) needs to change.
 */
export interface FulfillmentProvider {
  readonly name: FulfillmentProviderName;

  /** Fetch the provider's product/variant catalog for syncing into our DB. */
  getCatalog(): Promise<CatalogProduct[]>;

  /** Get current cost + shipping estimate for a set of variants (for future price comparison). */
  getQuotes(
    providerVariantIds: string[],
    destination: ShippingAddress
  ): Promise<VariantQuote[]>;

  /** Submit a paid order to the provider for printing & shipping. */
  submitOrder(
    items: FulfillmentOrderItem[],
    shipping: ShippingAddress,
    externalOrderId: string
  ): Promise<FulfillmentOrderResult>;

  /** Poll the provider for the current status of a previously submitted order. */
  getOrderStatus(providerOrderId: string): Promise<string>;
}
