import type {
  CatalogProduct,
  FulfillmentOrderItem,
  FulfillmentOrderResult,
  FulfillmentProvider,
  ShippingAddress,
  VariantQuote,
} from "./types";

const PRINTFUL_API_BASE = "https://api.printful.com";

function getApiKey(): string {
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) {
    throw new Error("PRINTFUL_API_KEY is not set");
  }
  return key;
}

async function printfulFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Printful API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.result as T;
}

/**
 * Printful implementation of the FulfillmentProvider interface.
 * https://developers.printful.com/docs/
 */
export class PrintfulProvider implements FulfillmentProvider {
  readonly name = "PRINTFUL" as const;

  async getCatalog(): Promise<CatalogProduct[]> {
    type StoreProduct = { id: number; name: string };
    type StoreProductDetail = {
      sync_product: { id: number; name: string };
      sync_variants: Array<{
        id: number;
        name: string;
        size?: string;
        color?: string;
        retail_price: string;
        currency: string;
      }>;
    };

    const products = await printfulFetch<StoreProduct[]>("/store/products");

    const detailed = await Promise.all(
      products.map((p) =>
        printfulFetch<StoreProductDetail>(`/store/products/${p.id}`)
      )
    );

    return detailed.map((d) => ({
      providerProductId: String(d.sync_product.id),
      name: d.sync_product.name,
      variants: d.sync_variants.map((v) => ({
        providerVariantId: String(v.id),
        name: v.name,
        options: {
          ...(v.size ? { size: v.size } : {}),
          ...(v.color ? { color: v.color } : {}),
        },
        costCents: Math.round(parseFloat(v.retail_price) * 100),
        currency: v.currency,
      })),
    }));
  }

  async getQuotes(
    providerVariantIds: string[],
    destination: ShippingAddress
  ): Promise<VariantQuote[]> {
    type RateResult = {
      rate: string;
      currency: string;
    };

    const items = providerVariantIds.map((id) => ({
      sync_variant_id: Number(id),
      quantity: 1,
    }));

    const result = await printfulFetch<RateResult[]>("/shipping/rates", {
      method: "POST",
      body: JSON.stringify({
        recipient: {
          address1: destination.address1,
          city: destination.city,
          state_code: destination.state,
          country_code: destination.country,
          zip: destination.zip,
        },
        items,
      }),
    });

    const shippingCents = result[0]
      ? Math.round(parseFloat(result[0].rate) * 100)
      : 0;
    const currency = result[0]?.currency ?? "USD";

    return providerVariantIds.map((id) => ({
      providerVariantId: id,
      costCents: 0,
      shippingCents,
      currency,
    }));
  }

  async submitOrder(
    items: FulfillmentOrderItem[],
    shipping: ShippingAddress,
    externalOrderId: string
  ): Promise<FulfillmentOrderResult> {
    type PrintfulOrder = { id: number; status: string };

    const result = await printfulFetch<PrintfulOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        external_id: externalOrderId,
        recipient: {
          name: shipping.name,
          address1: shipping.address1,
          address2: shipping.address2,
          city: shipping.city,
          state_code: shipping.state,
          country_code: shipping.country,
          zip: shipping.zip,
        },
        items: items.map((i) => ({
          sync_variant_id: Number(i.providerVariantId),
          quantity: i.quantity,
        })),
      }),
    });

    return { providerOrderId: String(result.id), status: result.status };
  }

  async getOrderStatus(providerOrderId: string): Promise<string> {
    type PrintfulOrder = { status: string };
    const result = await printfulFetch<PrintfulOrder>(
      `/orders/${providerOrderId}`
    );
    return result.status;
  }
}
