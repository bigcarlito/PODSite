import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newArrivals = await prisma.collection.upsert({
    where: { slug: "new-arrivals" },
    update: {},
    create: {
      slug: "new-arrivals",
      title: "New Arrivals",
      description: "Fresh off the press.",
    },
  });

  const sale = await prisma.collection.upsert({
    where: { slug: "sale" },
    update: {},
    create: {
      slug: "sale",
      title: "Sale",
      description: "Limited time deals.",
    },
  });

  const products = [
    {
      slug: "trailhead-tee",
      title: "Trailhead Tee",
      description:
        "A soft, breathable cotton tee for slow hikes and scenic overlooks. Printed on demand, one at a time.",
      isFeatured: true,
      collections: [newArrivals.id],
      variants: [
        { size: "S", color: "Forest", priceCents: 2995 },
        { size: "M", color: "Forest", priceCents: 2995 },
        { size: "L", color: "Forest", priceCents: 2995 },
        { size: "S", color: "Sand", priceCents: 2995 },
        { size: "M", color: "Sand", priceCents: 2995 },
        { size: "L", color: "Sand", priceCents: 2995 },
      ],
    },
    {
      slug: "basecamp-hoodie",
      title: "Basecamp Hoodie",
      description:
        "Heavyweight fleece hoodie built for chilly mornings at camp. Relaxed fit, kangaroo pocket.",
      isFeatured: true,
      collections: [newArrivals.id],
      variants: [
        { size: "M", color: "Charcoal", priceCents: 5495 },
        { size: "L", color: "Charcoal", priceCents: 5495 },
        { size: "XL", color: "Charcoal", priceCents: 5495 },
      ],
    },
    {
      slug: "wanderer-cap",
      title: "Wanderer Cap",
      description:
        "Low-profile cotton twill cap with an embroidered logo. One size fits most.",
      isFeatured: true,
      collections: [],
      variants: [{ size: "One Size", color: "Khaki", priceCents: 2495 }],
    },
    {
      slug: "scenic-route-tee",
      title: "Scenic Route Tee (Sale)",
      description:
        "A relaxed-fit graphic tee celebrating the long way around. Marked down for a limited time.",
      isFeatured: true,
      collections: [sale.id],
      variants: [
        { size: "S", color: "White", priceCents: 1995 },
        { size: "M", color: "White", priceCents: 1995 },
        { size: "L", color: "White", priceCents: 1995 },
      ],
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        title: p.title,
        description: p.description,
        isFeatured: p.isFeatured,
        collections: {
          create: p.collections.map((collectionId) => ({ collectionId })),
        },
        variants: {
          create: p.variants.map((v) => ({
            sku: `${p.slug}-${v.size}-${v.color}`.toLowerCase().replace(/\s+/g, "-"),
            size: v.size,
            color: v.color,
            priceCents: v.priceCents,
          })),
        },
      },
    });
    console.log(`Seeded product: ${product.title}`);
  }
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
