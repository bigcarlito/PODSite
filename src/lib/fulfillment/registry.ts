import type { FulfillmentProvider, FulfillmentProviderName } from "./types";
import { PrintfulProvider } from "./printful";

const providers: Partial<Record<FulfillmentProviderName, FulfillmentProvider>> = {
  PRINTFUL: new PrintfulProvider(),
  // PRINTIFY: new PrintifyProvider(),
  // GELATO: new GelatoProvider(),
};

export function getFulfillmentProvider(
  name: FulfillmentProviderName
): FulfillmentProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`No fulfillment provider registered for "${name}"`);
  }
  return provider;
}

export * from "./types";
