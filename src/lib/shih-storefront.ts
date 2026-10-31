/** Tenant presentation defaults; Store theme/copy remains editable through the agent API. */
export const shihStorefront = {
  wordmark: "ShihTshirts",
  homepageTitle: "Shih Tshirts - For Parents of Small Dogs with Big Attitude",
  decorations: [{
    src: "/images/shihtshirts/sami-bogey-header.png",
    alt: "",
    side: "right" as const,
    widthPercent: 15,
    bottomPercent: 0,
  }],
  featuredSubtitle: "Cute, funny, and full of attitude — just like your Shih Tzu.",
  nav: [{ label: "Shop", href: "/products" }, { label: "Our Story", href: "/about" }, { label: "Help", href: "/contact" }],
  tagline: "Small dogs. BIG ATTITUDE.",
  taglineLead: "Small dogs.",
  taglineEmphasis: "BIG ATTITUDE.",
  eyebrow: "For the humans who know who’s really in charge.",
  featuredTitle: "Shih Tzu Shirts for Every Personality",
  description: "Cute, funny, and full of attitude — just like your Shih Tzu.",
  shopLabel: "Shop All Shirts",
  trustBadges: ["Unique Shih Tzu designs", "Soft, comfy premium shirts", "Perfect for Shih Tzu people", "Dogs with personality"],
  closingBadges: ["Printed just for you", "Designed for Shih Tzu lovers", "Great for dog parents"],
};
export const isShihStore = (slug: string) => ["shihtshirt", "shihtshirts", "shihttshirts"].includes(slug);
