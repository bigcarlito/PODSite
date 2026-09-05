import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword, generateApiKey, hashApiKey } from "../src/lib/credentials";

const prisma = new PrismaClient();

function slugifyOptions(options: Record<string, string>) {
  return Object.values(options)
    .join("-")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

type SeedVariant = { options: Record<string, string>; priceCents: number };
type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  isFeatured: boolean;
  optionNames: string[];
  variants: SeedVariant[];
};

type SeedStore = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  tone: string;
  audience: string;
  theme: { accent: string; accentDark: string };
  collections: { slug: string; title: string; description: string }[];
  products: (collectionSlugs: Record<string, string>) => SeedProduct[];
};

/**
 * A fixed, easy-to-remember password for LOCAL DEV seeding only, so you
 * can log into any seeded store's /admin without hunting for a generated
 * one. Never use this pattern for real store creation — that's what
 * POST /api/platform/stores is for (see docs/AGENT_API.md), which
 * generates and returns real random credentials once.
 */
const DEV_ADMIN_PASSWORD = "devpassword123";

const stores: SeedStore[] = [
  {
    slug: "wildline",
    name: "Wildline Supply Co.",
    tagline: "Adventure, at your own pace.",
    description:
      "Premium print-on-demand apparel and gear, made for the slow, scenic route.",
    tone: "warm, unhurried, outdoorsy",
    audience: "casual hikers and outdoor gear enthusiasts",
    theme: { accent: "#3f4a2f", accentDark: "#2c3420" },
    collections: [
      { slug: "new-arrivals", title: "New Arrivals", description: "Fresh off the press." },
      { slug: "sale", title: "Sale", description: "Limited time deals." },
      { slug: "wall-art", title: "Wall Art", description: "Prints for the space between adventures." },
    ],
    products: () => [
      {
        slug: "trailhead-tee",
        title: "Trailhead Tee",
        description:
          "A soft, breathable cotton tee for slow hikes and scenic overlooks. Printed on demand, one at a time.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "S", color: "Forest" }, priceCents: 2995 },
          { options: { size: "M", color: "Forest" }, priceCents: 2995 },
          { options: { size: "L", color: "Forest" }, priceCents: 2995 },
          { options: { size: "S", color: "Sand" }, priceCents: 2995 },
          { options: { size: "M", color: "Sand" }, priceCents: 2995 },
          { options: { size: "L", color: "Sand" }, priceCents: 2995 },
        ],
      },
      {
        slug: "basecamp-hoodie",
        title: "Basecamp Hoodie",
        description:
          "Heavyweight fleece hoodie built for chilly mornings at camp. Relaxed fit, kangaroo pocket.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "M", color: "Charcoal" }, priceCents: 5495 },
          { options: { size: "L", color: "Charcoal" }, priceCents: 5495 },
          { options: { size: "XL", color: "Charcoal" }, priceCents: 5495 },
        ],
      },
      {
        slug: "wanderer-cap",
        title: "Wanderer Cap",
        description:
          "Low-profile cotton twill cap with an embroidered logo. One size fits most.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [{ options: { size: "One Size", color: "Khaki" }, priceCents: 2495 }],
      },
      {
        slug: "scenic-route-tee",
        title: "Scenic Route Tee (Sale)",
        description:
          "A relaxed-fit graphic tee celebrating the long way around. Marked down for a limited time.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "S", color: "White" }, priceCents: 1995 },
          { options: { size: "M", color: "White" }, priceCents: 1995 },
          { options: { size: "L", color: "White" }, priceCents: 1995 },
        ],
      },
      {
        slug: "trailhead-vista-print",
        title: "Trailhead Vista Print",
        description:
          "A wide-format landscape print of a ridgeline at golden hour. Available as a poster, gallery canvas, or framed print.",
        isFeatured: true,
        optionNames: ["printType", "size"],
        variants: [
          { options: { printType: "Poster", size: "11x14" }, priceCents: 1800 },
          { options: { printType: "Poster", size: "16x20" }, priceCents: 2800 },
          { options: { printType: "Poster", size: "24x36" }, priceCents: 4200 },
          { options: { printType: "Canvas", size: "11x14" }, priceCents: 3800 },
          { options: { printType: "Canvas", size: "16x20" }, priceCents: 5800 },
          { options: { printType: "Canvas", size: "24x36" }, priceCents: 8800 },
          { options: { printType: "Framed Print", size: "11x14" }, priceCents: 5800 },
          { options: { printType: "Framed Print", size: "16x20" }, priceCents: 8800 },
          { options: { printType: "Framed Print", size: "24x36" }, priceCents: 12800 },
        ],
      },
    ],
  },
  {
    slug: "first-available",
    name: "First Available",
    tagline: "Throw first. Explain later.",
    description:
      "Disc golf apparel for people who know exactly why that last shot went into the pond.",
    tone: "self-deprecating, insider humor",
    audience: "casual/intermediate disc golfers",
    theme: { accent: "#1f6f4a", accentDark: "#154d33" },
    collections: [
      { slug: "new-arrivals", title: "New Arrivals", description: "Fresh off the tee pad." },
    ],
    products: () => [
      {
        slug: "mando-or-nothing-tee",
        title: "Mando or Nothing Tee",
        description:
          "For the player who calls a mandatory line a suggestion. Soft cotton tee, printed on demand.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "S", color: "Black" }, priceCents: 2795 },
          { options: { size: "M", color: "Black" }, priceCents: 2795 },
          { options: { size: "L", color: "Black" }, priceCents: 2795 },
          { options: { size: "XL", color: "Black" }, priceCents: 2795 },
        ],
      },
      {
        slug: "one-more-hole-hoodie",
        title: "\"One More Hole\" Hoodie",
        description:
          "The lie every disc golfer tells their family. Midweight hoodie, front pocket.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "M", color: "Heather Gray" }, priceCents: 5295 },
          { options: { size: "L", color: "Heather Gray" }, priceCents: 5295 },
          { options: { size: "XL", color: "Heather Gray" }, priceCents: 5295 },
        ],
      },
      {
        slug: "circle-2-defender-cap",
        title: "Circle 2 Defender Cap",
        description:
          "Earned the hard way, one contested foot-fault at a time. Structured twill cap.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [{ options: { size: "One Size", color: "Forest" }, priceCents: 2495 }],
      },
    ],
  },
  {
    slug: "chicken-math-club",
    name: "Chicken Math Club",
    tagline: "You said three. It's fourteen now.",
    description:
      "Apparel and gifts for backyard chicken keepers who lost count a long time ago.",
    tone: "cute, chaotic, obsessive",
    audience: "backyard chicken owners (great for gifts, skews female)",
    theme: { accent: "#c2622a", accentDark: "#8f461c" },
    collections: [
      { slug: "new-arrivals", title: "New Arrivals", description: "Fresh from the coop." },
    ],
    products: () => [
      {
        slug: "chicken-math-tee",
        title: "Chicken Math Tee",
        description:
          "3 hens + 1 \"just looking\" trip to the feed store = 14 hens. The math checks out. Soft cotton tee.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "S", color: "Cream" }, priceCents: 2795 },
          { options: { size: "M", color: "Cream" }, priceCents: 2795 },
          { options: { size: "L", color: "Cream" }, priceCents: 2795 },
          { options: { size: "XL", color: "Cream" }, priceCents: 2795 },
        ],
      },
      {
        slug: "crazy-chicken-lady-hoodie",
        title: "Crazy Chicken Lady Hoodie",
        description:
          "Wear it proudly to the coop at 6am in your pajamas. Cozy fleece hoodie.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "S", color: "Blush" }, priceCents: 5295 },
          { options: { size: "M", color: "Blush" }, priceCents: 5295 },
          { options: { size: "L", color: "Blush" }, priceCents: 5295 },
        ],
      },
      {
        slug: "worlds-okayest-egg-layer-mug",
        title: "\"World's Okayest Egg Layer\" Print",
        description:
          "A gift for the hen who's really more of a pet at this point. Framable print.",
        isFeatured: true,
        optionNames: ["printType", "size"],
        variants: [
          { options: { printType: "Poster", size: "8x10" }, priceCents: 1400 },
          { options: { printType: "Framed Print", size: "8x10" }, priceCents: 3400 },
        ],
      },
    ],
  },
  {
    slug: "bird-nerd-society",
    name: "Bird Nerd Society",
    tagline: "Yes, I did stop the car for that.",
    description:
      "Apparel for birders who bring binoculars to brunch. Field-tested humor, life-list pride.",
    tone: "smart, nerdy, outdoorsy",
    audience: "serious-but-funny birdwatchers",
    theme: { accent: "#2b5f7a", accentDark: "#1c4152" },
    collections: [
      { slug: "new-arrivals", title: "New Arrivals", description: "Freshly spotted." },
    ],
    products: () => [
      {
        slug: "lifer-tee",
        title: "Lifer Tee",
        description:
          "For the exact moment you add a new species to your life list. Soft cotton tee.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [
          { options: { size: "S", color: "Slate" }, priceCents: 2795 },
          { options: { size: "M", color: "Slate" }, priceCents: 2795 },
          { options: { size: "L", color: "Slate" }, priceCents: 2795 },
          { options: { size: "XL", color: "Slate" }, priceCents: 2795 },
        ],
      },
      {
        slug: "binoculars-required-cap",
        title: "Binoculars Required Cap",
        description: "Field-ready structured cap for early starts and long lenses.",
        isFeatured: true,
        optionNames: ["size", "color"],
        variants: [{ options: { size: "One Size", color: "Olive" }, priceCents: 2495 }],
      },
      {
        slug: "warbler-plate-print",
        title: "Warbler Plate Print",
        description:
          "A field-guide-style illustrated plate print for the wall behind your spotting scope.",
        isFeatured: true,
        optionNames: ["printType", "size"],
        variants: [
          { options: { printType: "Poster", size: "11x14" }, priceCents: 1800 },
          { options: { printType: "Poster", size: "16x20" }, priceCents: 2800 },
          { options: { printType: "Framed Print", size: "11x14" }, priceCents: 5800 },
          { options: { printType: "Framed Print", size: "16x20" }, priceCents: 8800 },
        ],
      },
    ],
  },
];

async function main() {
  const credentialsLog: { slug: string; adminPassword: string; agentApiKey: string }[] = [];

  for (const s of stores) {
    const agentApiKey = generateApiKey();

    const store = await prisma.store.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        name: s.name,
        tagline: s.tagline,
        description: s.description,
        tone: s.tone,
        audience: s.audience,
        theme: s.theme,
        nav: [
          { label: "All Products", href: "/products" },
          { label: "New Arrivals", href: "/collections/new-arrivals" },
          { label: "About", href: "/about" },
        ] satisfies Prisma.InputJsonValue,
        footerLinks: {
          Help: [
            { label: "Contact", href: "/contact" },
            { label: "Shipping", href: "/policies/shipping" },
            { label: "Returns", href: "/policies/returns" },
          ],
          Company: [
            { label: "About Us", href: "/about" },
            { label: "Privacy Policy", href: "/policies/privacy" },
            { label: "Terms of Service", href: "/policies/terms" },
          ],
        } satisfies Prisma.InputJsonValue,
        trustBadges: ["30-day happiness guarantee", "Printed on demand"],
        socialLinks: [{ label: "Instagram", href: "https://instagram.com" }],
        adminPasswordHash: hashPassword(DEV_ADMIN_PASSWORD),
        agentApiKeyHash: hashApiKey(agentApiKey),
      },
    });

    credentialsLog.push({ slug: s.slug, adminPassword: DEV_ADMIN_PASSWORD, agentApiKey });

    const collectionIds: Record<string, string> = {};
    for (const c of s.collections) {
      const collection = await prisma.collection.upsert({
        where: { storeId_slug: { storeId: store.id, slug: c.slug } },
        update: {},
        create: { storeId: store.id, slug: c.slug, title: c.title, description: c.description },
      });
      collectionIds[c.slug] = collection.id;
    }

    for (const p of s.products(collectionIds)) {
      const product = await prisma.product.upsert({
        where: { storeId_slug: { storeId: store.id, slug: p.slug } },
        update: {},
        create: {
          storeId: store.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          isFeatured: p.isFeatured,
          optionNames: p.optionNames,
          collections: collectionIds["new-arrivals"]
            ? { create: [{ collectionId: collectionIds["new-arrivals"] }] }
            : undefined,
          variants: {
            create: p.variants.map((v) => ({
              storeId: store.id,
              sku: `${p.slug}-${slugifyOptions(v.options)}`,
              options: v.options,
              priceCents: v.priceCents,
            })),
          },
        },
      });
      console.log(`  Seeded product: ${product.title}`);
    }

    console.log(`Seeded store: ${store.name} (${store.slug})`);
  }

  console.log("\n=== Local dev credentials (never valid in production) ===");
  for (const c of credentialsLog) {
    console.log(
      `${c.slug}: admin password = "${c.adminPassword}", agent API key = ${c.agentApiKey}`
    );
  }
  console.log(
    "\nSet DEV_STORE_SLUG in .env to one of the slugs above to browse it at localhost:3000."
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
