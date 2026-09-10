import { StoreError } from "@/lib/store/errors";
import { openRouterImageProvider } from "./openrouter";
import type { ImageProvider } from "./types";

/**
 * Resolves an ImageProvider by the string stored in Design.provider — same
 * shape as src/lib/fulfillment/registry.ts. Adding a provider means adding
 * a case here and a file in this directory; never special-case a provider
 * name outside this file (see AGENTS.md #6).
 */
export function getImageProvider(name: string): ImageProvider {
  switch (name) {
    case "openrouter":
      return openRouterImageProvider;
    default:
      throw new StoreError("UNKNOWN_IMAGE_PROVIDER", `No image provider registered for "${name}"`, {
        status: 422,
        field: "provider",
      });
  }
}

export * from "./types";
