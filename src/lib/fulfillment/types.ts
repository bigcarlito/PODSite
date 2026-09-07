export type FulfillmentProviderName = "PRINTFUL" | "PRINTIFY" | "GELATO";

export interface CatalogVariant {
  providerVariantId: string;
  name: string;
  /** Provider-reported option values, e.g. {"size":"M","color":"Forest"}. */
  options?: Record<string, string>;
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

/** A provider catalog variant's garment color + which catalog product it belongs to. */
export interface VariantDetail {
  providerVariantId: string;
  /** Provider's color name, e.g. "Heather Forest". Empty if the product has no color axis. */
  colorName: string;
  /** Provider's hex for that color, e.g. "#3f4a2f" — what we contrast the design against. */
  colorHex: string;
  /** The catalog product (e.g. the blank tee model) this variant is a colorway of. */
  catalogProductId: string;
}

export interface MockupRequest {
  catalogProductId: string;
  providerVariantIds: string[];
  /** Publicly reachable URL of the print file (transparent PNG at print resolution). */
  imageUrl: string;
  /** Provider placement key, e.g. "front" / "back". */
  placement: string;
}

export interface MockupResult {
  providerVariantId: string;
  url: string;
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

  /**
   * Look up garment color (name + hex) and owning catalog product for
   * catalog variants. The hex is what decides whether a design is legible
   * on that garment — see src/lib/design/palette.ts.
   */
  getVariantDetails(providerVariantIds: string[]): Promise<VariantDetail[]>;

  /**
   * Render product mockups of `imageUrl` placed on the given catalog
   * variants. Resolves once the provider has finished rendering.
   */
  generateMockups(request: MockupRequest): Promise<MockupResult[]>;
}
