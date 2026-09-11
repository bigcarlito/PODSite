import type { CompiledDesignPrompt } from "../prompt";

export type GenerateDesignOpts = {
  /** Model slug to use, provider-specific — falls back to the adapter's own default. */
  model?: string;
  negativePrompt?: string;
};

export type GeneratedDesignImage = {
  /** Provider's native-resolution output, as a publicly fetchable URL or a data: URI. */
  imageUrl: string;
  width: number;
  height: number;
  /** Omitted where the provider has no concept of a reproducible seed. */
  seed?: number;
  /** Exactly what was sent to the provider, kept for the audit trail (Design.params). */
  rawParams: Record<string, unknown>;
};

/**
 * Mirrors src/lib/fulfillment/types.ts's FulfillmentProvider (AGENTS.md
 * #6): no single image model is trustworthy, cheap, and unrestricted
 * enough to hardcode, so image generation is pluggable the same way
 * Printful/Printify/Gelato are — an implementation of one interface,
 * chosen per design or per batch from data, never an if/else in the
 * pipeline. One file per provider in this directory, registered in
 * registry.ts keyed by the same string stored in Design.provider.
 */
export interface ImageProvider {
  name: string;
  generate(spec: CompiledDesignPrompt, opts: GenerateDesignOpts): Promise<GeneratedDesignImage>;
  /** Optional — providers without their own upscaler fall back to the
   * shared generic upscaler (see ../upscale.ts), never a hard dependency here. */
  upscale?(imageUrl: string, targetWidth: number, targetHeight: number): Promise<string>;
}
