import {
  ART_STYLE_FRAGMENTS,
  COLOR_SCHEME_FRAGMENTS,
  COLOR_SCHEME_ROLES,
  COMPLEXITY_FRAGMENTS,
  DESIGNED_FOR_SHADE_FRAGMENTS,
  LAYOUT_FRAGMENTS,
  type DesignAspects,
  type PrintRatio,
} from "./aspects";

/** A fill/shadow/outline/background color a provider can be given explicitly,
 * for providers that accept a palette parameter rather than only prose. */
export type ColorRole = { role: "fill" | "shadow" | "outline" | "background"; hex: string };

/**
 * The render contract every design shares regardless of aspects — never an
 * axis, since something that can't differ between two designs can't
 * explain a sales difference between them (see AGENTS.md's design-system
 * notes, rule 4).
 */
const RENDER_CONTRACT =
  "Flat print-ready apparel graphic, centered composition, isolated on a plain " +
  "transparent background, no garment, no mockup, no person, no frame or " +
  "border, no drop shadow beyond what's described, no watermark, crisp clean edges.";

/** Constant exclusions list — every provider gets these, folded into the
 * prompt text or passed as a native negative-prompt field (see providers/). */
export const DESIGN_EXCLUSIONS = [
  "photograph",
  "t-shirt mockup",
  "person wearing",
  "hanger",
  "fabric texture",
  "background scene",
  "gradient mesh",
  "drop shadow",
  "frame",
  "border",
  "watermark",
  "signature",
  "cropped text",
  "misspelled text",
  "extra letters",
  "blurry edges",
];

export type CompiledDesignPrompt = {
  promptText: string;
  colorRoles: ColorRole[];
  exclusions: string[];
  aspectRatioBucket: PrintRatio;
};

/** Fills a fragment's `{fill}`/`{shadow}`/`{outline}` placeholders from that
 * colorScheme's explicit roles, if any are defined. */
function resolveColorFragment(colorScheme: DesignAspects["colorScheme"]): string {
  const fragment = COLOR_SCHEME_FRAGMENTS[colorScheme];
  const roles = COLOR_SCHEME_ROLES[colorScheme];
  if (!roles) return fragment;
  let resolved = fragment;
  for (const { role, hex } of roles) {
    resolved = resolved.replace(`{${role}}`, hex);
  }
  return resolved;
}

/**
 * Pure, deterministic compiler: same aspects in, same prompt out, every
 * time — that determinism is what makes attributing a sale back to an
 * aspect combination valid (see AGENTS.md's design-system notes). Returns
 * a neutral intermediate representation, not a request shaped for any one
 * provider's API — providers/*.ts adapts this to their own fields.
 */
export function compileDesignPrompt(aspects: DesignAspects): CompiledDesignPrompt {
  const subjectClause = aspects.subject ? `${capitalize(aspects.subject)}. ` : "";
  const phraseClause = aspects.phrase
    ? `The words "${aspects.phrase}" rendered exactly and spelled correctly in bold display lettering. `
    : "";

  const promptText = [
    `${LAYOUT_FRAGMENTS[aspects.layout]}.`,
    `${subjectClause}${phraseClause}`.trim(),
    `${ART_STYLE_FRAGMENTS[aspects.artStyle]}.`,
    `${resolveColorFragment(aspects.colorScheme)}.`,
    `${COMPLEXITY_FRAGMENTS[aspects.complexity]}.`,
    `${DESIGNED_FOR_SHADE_FRAGMENTS[aspects.designedForShade]}.`,
    RENDER_CONTRACT,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    promptText,
    colorRoles: COLOR_SCHEME_ROLES[aspects.colorScheme] ?? [],
    exclusions: DESIGN_EXCLUSIONS,
    aspectRatioBucket: aspects.printRatio,
  };
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
