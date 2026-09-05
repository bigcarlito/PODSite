import { withPlatformAuth } from "@/lib/store/api-helpers";
import { createStore } from "@/lib/platform";
import { storeCreateSchema } from "@/lib/platform-schemas";

export const dynamic = "force-dynamic";

export const POST = withPlatformAuth(async (request) => {
  const body = await request.json();
  const input = storeCreateSchema.parse(body);
  const { store, credentials } = await createStore(input);

  // Allow-list what's exposed, rather than deny-list secrets — safer by
  // default if a new secret field is ever added to Store.
  const safeStore = {
    id: store.id,
    slug: store.slug,
    domain: store.domain,
    isActive: store.isActive,
    name: store.name,
    tagline: store.tagline,
    description: store.description,
    tone: store.tone,
    audience: store.audience,
    theme: store.theme,
    nav: store.nav,
    footerLinks: store.footerLinks,
    trustBadges: store.trustBadges,
    socialLinks: store.socialLinks,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };

  return Response.json({ store: safeStore, credentials }, { status: 201 });
});
