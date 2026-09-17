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
 *
 * `designType`, `archetype`, and `distressLevel` (added in version 2) come
 * from the same controlled-vocabulary taxonomy as a batch of t-shirt
 * design concepts (see src/lib/design/concepts.ts /
 * tshirt-design-concepts.md) — they're just as enumerable as `artStyle`/
 * `layout`, so they belong here rather than as free text on a concept.
 */
export const ASPECTS_VERSION = 2;

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

/** Max distinct significant colors a colorScheme value promises — the QC
 * gate (qc.ts) rejects a render that exceeds this, since it means the
 * aspect didn't actually take effect. Omitted values (the free-palette
 * ones like muted_earth/bright_primary) aren't capped. */
export const COLOR_SCHEME_MAX_COLORS: Partial<Record<ColorScheme, number>> = {
  one_color_white: 1,
  one_color_black: 1,
  two_color_contrast: 2,
  retro_three_color: 3,
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

/** The print-treatment/finish family — sets texture, distress, and which
 * archetypes fit (see tshirt-design-concepts.md Step 3). Each fragment is
 * the opening print-finish instruction dropped into the compiled prompt. */
export const DESIGN_TYPE_VALUES = [
  "vintage_weathered",
  "type_only_lockup",
  "hand_drawn_ink",
  "single_color_overprint",
  "retro_poster",
  "block_print_linocut",
  "bold_line_tattoo_flash",
  "clean_vector",
] as const;
export type DesignType = (typeof DESIGN_TYPE_VALUES)[number];

export const DESIGN_TYPE_FRAGMENTS: AspectAxis<DesignType> = {
  vintage_weathered:
    "Vintage screen-printed t-shirt graphic, heavily distressed ink with fine cracking and speckle, halftone dot shading in the fills, eroded ragged edges, faded sun-bleached ink colors, looks washed a hundred times",
  type_only_lockup:
    "Typographic t-shirt design, text only, no illustration or imagery of any kind, vintage screen-print texture on the letterforms",
  hand_drawn_ink:
    "Hand-drawn pen and brush ink illustration, wobbly imperfect linework with varying stroke weight, crosshatch and stipple shading, hand-lettered text with natural inconsistency, looks drawn in a sketchbook",
  single_color_overprint:
    "Single-color screen print, one ink only, every tonal value achieved through halftone dots and line density rather than a second color, heavy contrast, bold graphic silhouettes, slight ink spread and press texture",
  retro_poster:
    "1970s screen-printed poster style, horizontal stripe bands and sunburst rays, warm limited palette, heavy uniform grain across the whole design, groovy rounded display lettering, slight plate misregistration",
  block_print_linocut:
    "Hand-carved linocut block print, rough chiseled edges with visible carve marks and nicks, uneven ink coverage with visible press texture, bold simplified shapes, rustic and tactile",
  bold_line_tattoo_flash:
    "American traditional tattoo flash, heavy uniform black outlines, flat limited palette, banner scroll with lettering, dot and line shading, bold simple shapes with no fine detail",
  clean_vector:
    "Clean flat vector t-shirt graphic, crisp geometric shapes, precise even edges, bold solid fills, modern minimal styling, subtle paper grain only",
};

/** The visual layout archetype — see tshirt-design-concepts.md Step 4. Kept
 * as prose labels (not composition instructions like `layout` above) since
 * distinguishing e.g. "worn tour tee" from "vintage athletic / varsity" in
 * the prompt matters more for aspect-level attribution than for rendering
 * — the compiled prompt names the archetype and lets designType/subject
 * carry the actual composition detail. */
export const ARCHETYPE_VALUES = [
  "centered_badge_emblem",
  "stacked_type_lockup",
  "retro_sunset_scene",
  "vintage_athletic_varsity",
  "mascot_illustration",
  "tattoo_flash",
  "woodcut_engraving",
  "blueprint_diagram",
  "worn_tour_tee",
  "sticker_sheet_collage",
  "kitsch_90s_y2k",
  "hand_drawn_doodle",
  "celestial_sacred_geometry",
  "minimal_line_art",
  "left_chest_mark",
] as const;
export type Archetype = (typeof ARCHETYPE_VALUES)[number];

export const ARCHETYPE_FRAGMENTS: AspectAxis<Archetype> = {
  centered_badge_emblem:
    "Centered badge/emblem composition — a circular or shield seal with outer ring text, a rope or laurel border, and a banner ribbon",
  stacked_type_lockup: "Stacked type lockup — 3 to 5 lines of mixed weights and widths, top line arched, one word oversized",
  retro_sunset_scene: "Retro sunset scene — horizontal stripe bands, a sun arc, and a silhouette subject",
  vintage_athletic_varsity: "Vintage athletic/varsity composition — collegiate block letters, an arched top line, and a number",
  mascot_illustration: "Mascot illustration — bold uneven outlines, flat cel-shading, an exaggerated expression",
  tattoo_flash: "Tattoo flash composition — heavy black linework, a banner scroll, dot shading",
  woodcut_engraving: "Woodcut/engraving composition — fine parallel hatching, single ink, an antique specimen-plate feel",
  blueprint_diagram: "Blueprint/diagram composition — an exploded view with labeled callouts, leader lines, monospaced labels",
  worn_tour_tee: "Worn tour tee composition — heavy grit, halftone, cracked ink, two colors",
  sticker_sheet_collage: "Sticker sheet/patch collage — 5 to 8 small elements scattered in a loose grid",
  kitsch_90s_y2k: "Kitsch 90s/Y2K composition — bubble type, starbursts, checkerboard, Memphis squiggles",
  hand_drawn_doodle: "Hand-drawn doodle composition — wobbly marker linework, handwritten lettering",
  celestial_sacred_geometry: "Celestial/sacred geometry composition — moon phases, star fields, line-art constellation",
  minimal_line_art: "Minimal line art composition — a single continuous contour in one ink color, huge negative space",
  left_chest_mark: "Left-chest mark composition — a small self-contained icon plus one to three words, reads at 3 inches",
};

/** How thrashed the print looks, per tshirt-design-concepts.md Step 6 — the
 * "printed into the shirt, not stuck on it" instructions. Level 0 (clean)
 * is meant for designType clean_vector only. */
export const DISTRESS_LEVEL_VALUES = ["0", "1", "2", "3"] as const;
export type DistressLevel = (typeof DISTRESS_LEVEL_VALUES)[number];

export const DISTRESS_LEVEL_FRAGMENTS: AspectAxis<DistressLevel> = {
  "0": "Clean flat edges, subtle paper grain only.",
  "1": "Light screen-print grain, faintly irregular edges, ink not perfectly opaque (around 92%).",
  "2":
    "Vintage screen-print texture, ink broken by fine distress speckle, eroded ragged edges, halftone dot shading in the fills, slight plate misregistration, ink around 86% opaque.",
  "3": "Heavily distressed and faded vintage print, cracked and flaking ink, significant wear, looks washed a hundred times.",
};

/** The "sticker tells" this platform's designs must never carry (see
 * tshirt-design-concepts.md Step 6) — appended to every compiled prompt
 * regardless of designType, since even the intentionally-clean designType
 * (distressLevel "0") still bans a keyline and pure white. */
export const NO_KEYLINE_FRAGMENT =
  "The design has no outer border, frame, keyline, or die-cut outline — its outermost elements " +
  "break up or fade out instead of stopping at a hard contour. Never pure white or pure black " +
  "anywhere — use an aged white and a soft black instead. It should look printed into a worn " +
  "shirt, not like a sticker applied on top of one.";

/** Only meaningful once there's real distress to render (distressLevel !=
 * "0") — instructs the gaps to be the flat background color rather than a
 * grey overlay, so removing the background leaves them genuinely
 * transparent (the print-realism transparency trick). */
export const DISTRESS_TRANSPARENCY_FRAGMENT =
  "Render all distress, cracking, and halftone gaps as the flat background color showing " +
  "through the ink, never as a grey or tinted overlay.";

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
  /// Print-treatment family (Step 3) — optional so version-1 designs (no
  /// designType) still validate; compileDesignPrompt() falls back to
  /// vintage_weathered's fragment when omitted.
  designType: z.enum(DESIGN_TYPE_VALUES).default("vintage_weathered"),
  /// Visual layout archetype (Step 4) — optional, no default fragment is
  /// added to the prompt when omitted.
  archetype: z.enum(ARCHETYPE_VALUES).nullable().default(null),
  /// How thrashed the print looks (Step 6) — defaults to the skill's
  /// documented default level.
  distressLevel: z.enum(DISTRESS_LEVEL_VALUES).default("2"),
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
  designType: DESIGN_TYPE_VALUES,
  archetype: ARCHETYPE_VALUES,
  distressLevel: DISTRESS_LEVEL_VALUES,
};
