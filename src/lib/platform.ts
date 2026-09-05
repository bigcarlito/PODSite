import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateApiKey, hashApiKey } from "@/lib/credentials";
import { StoreError } from "@/lib/store/errors";
import type { StoreCreateInput } from "@/lib/platform-schemas";

/**
 * Creates a new store (tenant) from a brand brief. This is the mechanism
 * behind "create a store dynamically via an AI agent" — insert a row,
 * hand the caller its credentials once, then use the normal
 * /api/agent/products (etc.) endpoints with the new store's key to
 * populate its catalog. See docs/AGENT_API.md "Creating a new store".
 */
export async function createStore(input: StoreCreateInput) {
  const existing = await prisma.store.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new StoreError(
      "SLUG_TAKEN",
      `A store with slug "${input.slug}" already exists`,
      { field: "slug", status: 409 }
    );
  }

  const adminPassword = generateApiKey().slice(0, 20); // random, human-typeable enough
  const agentApiKey = generateApiKey();

  const store = await prisma.store.create({
    data: {
      slug: input.slug,
      domain: input.domain,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      tone: input.tone,
      audience: input.audience,
      theme: input.theme ?? {},
      nav: input.nav ?? [],
      footerLinks: input.footerLinks ?? {},
      trustBadges: input.trustBadges ?? [],
      socialLinks: input.socialLinks ?? [],
      printfulApiKey: input.printfulApiKey,
      adminPasswordHash: hashPassword(adminPassword),
      agentApiKeyHash: hashApiKey(agentApiKey),
    },
  });

  return {
    store,
    // Shown only in this response — neither is recoverable afterward.
    credentials: { adminPassword, agentApiKey },
  };
}
