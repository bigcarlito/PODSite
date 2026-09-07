import type {
  CatalogProduct,
  FulfillmentOrderItem,
  FulfillmentOrderResult,
  FulfillmentProvider,
  MockupRequest,
  MockupResult,
  ShippingAddress,
  VariantDetail,
  VariantQuote,
} from "./types";

const PRINTFUL_API_BASE = "https://api.printful.com";

/**
 * Printful implementation of the FulfillmentProvider interface.
 * https://developers.printful.com/docs/
 *
 * Takes the API key explicitly (a specific store's own Printful account,
 * or falls back to the platform default) rather than reading env vars
 * inside each method — each store may use a different Printful account.
 */
export class PrintfulProvider implements FulfillmentProvider {
  readonly name = "PRINTFUL" as const;

  constructor(
    private readonly apiKey?: string,
    private readonly storeId?: string
  ) {}

  private getApiKey(): string {
    const key = this.apiKey ?? process.env.PRINTFUL_API_KEY;
    if (!key) {
      throw new Error("No Printful API key configured for this store");
    }
    return key;
  }

  private async printfulFetch<T>(path: string, init?: RequestInit): Promise<T> {
    // A modern (OAuth/multi-store) Printful token rejects most endpoints
    // with a 400 "This endpoint requires `store_id`!" unless the target
    // store is named explicitly — a legacy single-store token ignores this
    // header, so it's safe to always send it when we have one.
    const storeId = this.storeId ?? process.env.PRINTFUL_STORE_ID;

    const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
        ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
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

    const products = await this.printfulFetch<StoreProduct[]>("/store/products");

    const detailed = await Promise.all(
      products.map((p) =>
        this.printfulFetch<StoreProductDetail>(`/store/products/${p.id}`)
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

    const result = await this.printfulFetch<RateResult[]>("/shipping/rates", {
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

    const result = await this.printfulFetch<PrintfulOrder>("/orders", {
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
    const result = await this.printfulFetch<PrintfulOrder>(
      `/orders/${providerOrderId}`
    );
    return result.status;
  }

  /**
   * Note: these are Printful *catalog* variant ids (the blank garment
   * colorway), which is what the mockup generator works in. That's a
   * different id space from the *sync* variant ids getCatalog/submitOrder
   * use. A sync id here fails loudly rather than silently rendering the
   * wrong garment.
   */
  async getVariantDetails(providerVariantIds: string[]): Promise<VariantDetail[]> {
    type VariantResponse = {
      variant: {
        id: number;
        product_id: number;
        color?: string | null;
        color_code?: string | null;
      };
    };

    const unique = [...new Set(providerVariantIds)];

    return Promise.all(
      unique.map(async (id) => {
        let result: VariantResponse;
        try {
          result = await this.printfulFetch<VariantResponse>(
            `/products/variant/${id}`
          );
        } catch (cause) {
          throw new Error(
            `Printful catalog variant "${id}" not found. Mockups need catalog ` +
              `variant ids (the blank garment colorway), not sync variant ids. ` +
              `Cause: ${cause instanceof Error ? cause.message : String(cause)}`
          );
        }

        return {
          providerVariantId: String(result.variant.id),
          colorName: result.variant.color ?? "",
          colorHex: result.variant.color_code ?? "",
          catalogProductId: String(result.variant.product_id),
        };
      })
    );
  }

  async generateMockups(request: MockupRequest): Promise<MockupResult[]> {
    type CreateTask = { task_key: string; status: string };
    type TaskStatus = {
      status: "pending" | "completed" | "failed";
      error?: string;
      mockups?: Array<{
        placement: string;
        variant_ids: number[];
        mockup_url: string;
      }>;
    };
    type PrintfilesResponse = {
      printfiles: Array<{ printfile_id: number; width: number; height: number }>;
      // Placement -> display label (e.g. "Front"), NOT a printfile id —
      // the actual placement -> printfile mapping is per *variant*, in
      // variant_printfiles, since different variants (e.g. youth vs adult
      // sizes) can use different print files for the same placement.
      available_placements: Record<string, string>;
      variant_printfiles: Array<{ variant_id: number; placements: Record<string, number> }>;
    };

    // Some catalog products reject a file with no explicit `position`
    // ("Position field is missing", MG-4) rather than defaulting to the
    // full print area — look up that area's actual dimensions and place
    // the file to fill it edge-to-edge.
    const printfiles = await this.printfulFetch<PrintfilesResponse>(
      `/mockup-generator/printfiles/${request.catalogProductId}`
    );
    const requestedIds = new Set(request.providerVariantIds.map(Number));
    const variantPrintfiles = printfiles.variant_printfiles.find((vp) =>
      requestedIds.has(vp.variant_id)
    );
    const printfileId = variantPrintfiles?.placements[request.placement];
    const printfile = printfiles.printfiles.find((p) => p.printfile_id === printfileId);
    if (!printfile) {
      throw new Error(
        `Printful catalog product "${request.catalogProductId}" has no print ` +
          `area for placement "${request.placement}" on variant ` +
          `${variantPrintfiles?.variant_id ?? request.providerVariantIds[0]}. ` +
          `Available placements: ` +
          `${Object.keys(variantPrintfiles?.placements ?? printfiles.available_placements).join(", ") || "(none)"}`
      );
    }

    const task = await this.printfulFetch<CreateTask>(
      `/mockup-generator/create-task/${request.catalogProductId}`,
      {
        method: "POST",
        body: JSON.stringify({
          variant_ids: request.providerVariantIds.map(Number),
          format: "jpg",
          files: [
            {
              placement: request.placement,
              image_url: request.imageUrl,
              position: {
                area_width: printfile.width,
                area_height: printfile.height,
                width: printfile.width,
                height: printfile.height,
                top: 0,
                left: 0,
              },
            },
          ],
        }),
      }
    );

    // Rendering is async on Printful's side; poll until it settles.
    const deadline = Date.now() + 90_000;
    let delayMs = 2_000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.5, 10_000);

      const status = await this.printfulFetch<TaskStatus>(
        `/mockup-generator/task?task_key=${encodeURIComponent(task.task_key)}`
      );

      if (status.status === "failed") {
        throw new Error(
          `Printful mockup generation failed: ${status.error ?? "unknown error"}`
        );
      }
      if (status.status === "completed") {
        return (status.mockups ?? []).flatMap((mockup) =>
          mockup.variant_ids.map((variantId) => ({
            providerVariantId: String(variantId),
            url: mockup.mockup_url,
          }))
        );
      }
    }

    throw new Error("Printful mockup generation timed out after 90s");
  }
}
