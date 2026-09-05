import type { FulfillmentProvider, FulfillmentProviderName } from "./types";
import { PrintfulProvider } from "./printful";

/**
 * Resolves a provider instance for a given store. Each store may supply
 * its own credentials (e.g. Store.printfulApiKey) — providers are
 * constructed per call rather than shared singletons so credentials never
 * leak across stores. Adding Gelato/Printify means adding a case here;
 * never special-case a provider name outside this file (see AGENTS.md #6).
 */
export function getFulfillmentProvider(
  name: FulfillmentProviderName,
  apiKey?: string | null
): FulfillmentProvider {
  switch (name) {
    case "PRINTFUL":
      return new PrintfulProvider(apiKey ?? undefined);
    default:
      throw new Error(`No fulfillment provider registered for "${name}"`);
  }
}

export * from "./types";
