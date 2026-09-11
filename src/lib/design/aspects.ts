import { z } from "zod";

/**
 * The structured-design vocabulary — see the design-system plan in
 * AGENTS.md. Each axis maps its legal values to (a) a prompt fragment
 * compileDesignPrompt() (prompt.ts) assembles into the final prompt, and
 * (b) implicitly, a Zod enum for validation. One file is the whole
 * taxonomy: adding a value here is a data change, never a migration (see
 * AGENTS.md #10) — but bump ASPECTS_VERSION whenever a value's *meaning*
 * changes, since silently redefining "vintage_distressed" would corrupt
 * comparisons against designs generated under the old meaning.
 *
 * Only `hook`, `layout`, `artStyle`, `colorScheme`, and `complexity` are
 * experiment axes analyzed as levels — `phrase` and `subject` are free
 * text analyzed as content, and `occasion`/`designedForShade`/`printRatio`
 * are context/placement, not things to A/B.
 */
export const ASPECTS_VERSION = 1;

/** One controlled-vocabulary axis: legal values, each with its prompt fragment. */
type AspectAxis<V extends string> = Record<V, string>;

export const HOOK_VALUES = [
  "insider_joke",
  "pun",
  "identity_badge",
  "sarcasm",
  "affirmation",
  "nostalgia",
  "obsession",
  "milestone",
] as const;
export type Hook = (typeof HOOK_VALUES)[number];

export const OCCASION_VALUES = [
  "everyday",
  "gift",
  "holiday",
  "dated_event",
  "milestone",
] as const;
export type Occasion = (typeof OCCASION_VALUES)[number];

export const LAYOUT_VALUES = [
  "text_only_stacked",
  "text_arch_badge",
  "text_with_small_icon",
  "icon_above_text",
  "illustration_with_caption",
  "illustration_only",
  "circular_emblem",
  "split_banner",
] as const;
export type Layout = (typeof LAYOUT_VALUES)[number];

/** Prompt fragment per `layout` value — the composition instruction. */
export const LAYOUT_FRAGMENTS: AspectAxis<Layout> = {
  text_only_stacked: "Stacked typographic composition, words on multiple lines, no illustration",
  text_arch_badge: "Text arched along the top of a circular or shield-shaped badge composition",
  text_with_small_icon: "Display lettering with one small supporting icon beside or below the text",
  icon_above_text: "A single illustrated icon centered directly above stacked display lettering",
  illustration_with_caption: "A detailed illustration with a short caption of text beneath it",
  illustration_only: "A standalone illustration with no text",
  circular_emblem: "A circular emblem/badge composition with text following the ring and an icon in the center",
  split_banner: "A banner-style composition split into two horizontal bands of text and imagery",
};

export const ART_STYLE_VALUES = [
  "vintage_distressed",
  "retro_70s_groovy",
  "bold_block_type",
  "hand_lettered_script",
  "flat_vector_mascot",
  "line_art_minimal",
  "comic_halftone",
  "kawaii_cute",
] as const;
export type ArtStyle = (typeof ART_STYLE_VALUES)[number];

/** Prompt fragment per `artStyle` value — the rendering-style instruction. */
export const ART_STYLE_FRAGMENTS: AspectAxis<ArtStyle> = {
  vintage_distressed: "1970s screen-print look with distressed halftone texture and slightly rough, worn edges",
  retro_70s_groovy: "Retro 1970s groovy style with rounded bubble lettering and wavy organic shapes",
  bold_block_type: "Bold, heavy block lettering with strong geometric shapes, no distressing",
  hand_lettered_script: "Hand-lettered script style with flowing, organic brush strokes",
  flat_vector_mascot: "Flat vector illustration of a mascot-style character, clean solid shapes, no gradients",
  line_art_minimal: "Clean single-weight line art, no fills, no shading",
  comic_halftone: "Comic-book style with bold outlines and halftone dot shading",
  kawaii_cute: "Kawaii-style cute illustration with rounded, oversized, friendly features",
};

export const COLOR_SCHEME_VALUES = [
  "one_color_white",
  "one_color_black",
  "two_color_contrast",
  "retro_three_color",
  "muted_earth",
  "bright_primary",
  "pastel_soft",
  "neon_pop",
] as const;
export type ColorScheme = (typeof COLOR_SCHEME_VALUES)[number];

/**
 * Prompt fragment + explicit color roles per `colorScheme` value. Color
 * needs roles (fill/shadow/outline/background), not adjectives — "two
 * colors, cream and green" tells a model *what* colors but not *where*,
 * and the safe default is then a flat single-tone render. Each fragment
 * names the roles explicitly; `roles` carries the same hex values for
 * providers that accept an explicit palette parameter (see providers/).
 */
export const COLOR_SCHEME_FRAGMENTS: AspectAxis<ColorScheme> = {
  one_color_white: "Rendered entirely in a single flat white ink, no other colors",
  one_color_black: "Rendered entirely in a single flat black ink, no other colors",
  two_color_contrast:
    "Two-color design: the main shapes filled solid in {fill}, with a thin offset shadow or outline in {shadow}",
  retro_three_color: "A limited three-color retro palette of cream, rust orange and faded teal",
  muted_earth: "A muted earth-tone palette of clay, olive and warm cream",
  bright_primary: "A bright primary-color palette of red, blue and yellow",
  pastel_soft: "A soft pastel palette of blush pink, mint and lavender",
  neon_pop: "A high-contrast neon palette of hot pink and electric green on black",
};

export const COLOR_SCHEME_ROLES: Partial<
  Record<ColorScheme, { role: "fill" | "shadow" | "outline" | "background"; hex: string }[]>
> = {
  two_color_contrast: [
    { role: "fill", hex: "#1a1a1a" },
    { role: "shadow", hex: "#e8e2d0" },
  ],
  retro_three_color: [
    { role: "fill", hex: "#f2ead6" },
    { role: "shadow", hex: "#c05a2c" },
    { role: "outline", hex: "#2f6e6e" },
  ],
};

export const COMPLEXITY_VALUES = ["minimal", "moderate", "detailed"] as const;
export type Complexity = (typeof COMPLEXITY_VALUES)[number];

/** Prompt fragment per `complexity` value — how much is in the composition. */
export const COMPLEXITY_FRAGMENTS: AspectAxis<Complexity> = {
  minimal: "Minimal detail: one subject and the headline, nothing else in the composition",
  moderate: "Moderate detail: one main subject plus the headline, no background elements",
  detailed: "Detailed composition with supporting elements around the main subject and headline",
};

export const DESIGNED_FOR_SHADE_VALUES = ["dark", "light", "both"] as const;
export type DesignedForShade = (typeof DESIGNED_FOR_SHADE_VALUES)[number];

/** Prompt fragment per `designedForShade` value — ink tone vs. garment tone. */
export const DESIGNED_FOR_SHADE_FRAGMENTS: AspectAxis<DesignedForShade> = {
  dark: "Light-toned artwork intended to be printed on a dark garment",
  light: "Dark-toned artwork intended to be printed on a light garment",
  both: "Medium-contrast artwork designed to read on both light and dark garments",
};

export const PRINT_RATIO_VALUES = ["square_1_1", "portrait_4_5", "wide_3_2", "pocket_1_1"] as const;
export type PrintRatio = (typeof PRINT_RATIO_VALUES)[number];

/** Neutral aspect-ratio bucket per `printRatio` value, resolved to a
 * provider-specific bucket name by each ImageProvider adapter. */
export const PRINT_RATIO_DIMENSIONS: Record<PrintRatio, { width: number; height: number }> = {
  square_1_1: { width: 1, height: 1 },
  portrait_4_5: { width: 4, height: 5 },
  wide_3_2: { width: 3, height: 2 },
  pocket_1_1: { width: 1, height: 1 },
};

export const PLACEMENT_VALUES = ["front_center", "left_chest", "back_full", "sleeve"] as const;
export type Placement = (typeof PLACEMENT_VALUES)[number];

/** Zod schema for the full aspects object — every field except `phrase`/
 * `subject` is a controlled-vocabulary enum from the lists above. */
export const aspectsSchema = z.object({
  hook: z.enum(HOOK_VALUES),
  occasion: z.enum(OCCASION_VALUES),
  phrase: z.string().trim().max(60).nullable().default(null),
  subject: z.string().trim().toLowerCase().max(60).nullable().default(null),
  layout: z.enum(LAYOUT_VALUES),
  artStyle: z.enum(ART_STYLE_VALUES),
  colorScheme: z.enum(COLOR_SCHEME_VALUES),
  complexity: z.enum(COMPLEXITY_VALUES),
  designedForShade: z.enum(DESIGNED_FOR_SHADE_VALUES),
  printRatio: z.enum(PRINT_RATIO_VALUES),
  placement: z.enum(PLACEMENT_VALUES),
});

export type DesignAspects = z.infer<typeof aspectsSchema>;

/** Everything GET /api/agent/designs/vocabulary returns — how an agent
 * learns the legal values without hardcoding them. */
export const DESIGN_VOCABULARY = {
  version: ASPECTS_VERSION,
  hook: HOOK_VALUES,
  occasion: OCCASION_VALUES,
  layout: LAYOUT_VALUES,
  artStyle: ART_STYLE_VALUES,
  colorScheme: COLOR_SCHEME_VALUES,
  complexity: COMPLEXITY_VALUES,
  designedForShade: DESIGNED_FOR_SHADE_VALUES,
  printRatio: PRINT_RATIO_VALUES,
  placement: PLACEMENT_VALUES,
};
