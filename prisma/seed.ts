import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugifyOptions(options: Record<string, string>) {
  return Object.values(options)
    .join("-")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

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

  const wallArt = await prisma.collection.upsert({
    where: { slug: "wall-art" },
    update: {},
    create: {
      slug: "wall-art",
      title: "Wall Art",
      description: "Prints for the space between adventures.",
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
      collections: [newArrivals.id],
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
      collections: [] as string[],
      optionNames: ["size", "color"],
      variants: [
        { options: { size: "One Size", color: "Khaki" }, priceCents: 2495 },
      ],
    },
    {
      slug: "scenic-route-tee",
      title: "Scenic Route Tee (Sale)",
      description:
        "A relaxed-fit graphic tee celebrating the long way around. Marked down for a limited time.",
      isFeatured: true,
      collections: [sale.id],
      optionNames: ["size", "color"],
      variants: [
        { options: { size: "S", color: "White" }, priceCents: 1995 },
        { options: { size: "M", color: "White" }, priceCents: 1995 },
        { options: { size: "L", color: "White" }, priceCents: 1995 },
      ],
    },
    {
      // Demonstrates a non-apparel product: different option keys
      // (printType, size instead of size, color), and independent pricing
      // per print type/size combination — framed prints cost more than
      // posters at the same size, larger sizes cost more within a type.
      slug: "trailhead-vista-print",
      title: "Trailhead Vista Print",
      description:
        "A wide-format landscape print of a ridgeline at golden hour. Available as a poster, gallery canvas, or framed print.",
      isFeatured: true,
      collections: [wallArt.id],
      optionNames: ["printType", "size"],
      variants: [
        { options: { printType: "Poster", size: "11x14" }, priceCents: 1800 },
        { options: { printType: "Poster", size: "16x20" }, priceCents: 2800 },
        { options: { printType: "Poster", size: "24x36" }, priceCents: 4200 },
        { options: { printType: "Canvas", size: "11x14" }, priceCents: 3800 },
        { options: { printType: "Canvas", size: "16x20" }, priceCents: 5800 },
        { options: { printType: "Canvas", size: "24x36" }, priceCents: 8800 },
        {
          options: { printType: "Framed Print", size: "11x14" },
          priceCents: 5800,
        },
        {
          options: { printType: "Framed Print", size: "16x20" },
          priceCents: 8800,
        },
        {
          options: { printType: "Framed Print", size: "24x36" },
          priceCents: 12800,
        },
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
        optionNames: p.optionNames,
        collections: {
          create: p.collections.map((collectionId) => ({ collectionId })),
        },
        variants: {
          create: p.variants.map((v) => ({
            sku: `${p.slug}-${slugifyOptions(v.options)}`,
            options: v.options,
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
