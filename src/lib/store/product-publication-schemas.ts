import { z } from "zod";

export const productPublicationInputSchema = z.object({}).strict();
export const productPublicationResultSchema = z.object({
  product: z.object({
    id: z.string(), storeId: z.string(), isActive: z.boolean(),
    variants: z.array(z.object({ id: z.string(), inStock: z.boolean(), priceCents: z.number().int(), currency: z.string() }).passthrough()),
    images: z.array(z.object({ url: z.string() }).passthrough()),
  }).passthrough(),
});
