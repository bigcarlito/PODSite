import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Store } from "@prisma/client";
import { DEFAULT_TEXT_MODEL, generateTextWithOpenRouter } from "@/lib/ai/openrouter";
import { StoreError } from "@/lib/store/errors";
import { aspectsSchema, DESIGN_VOCABULARY, type DesignType } from "./aspects";

/** Loaded once at module load — editing this file changes what
 * generateDesignConcepts() produces without a code change (see the file's
 * own header comment). */
const SKILL_MARKDOWN = readFileSync(
  join(process.cwd(), "src/lib/design/tshirt-design-concepts.md"),
  "utf-8"
);

/** A concept is every aspects field (validated the same way createDesign
 * validates them) plus two display-only fields for the review queue. */
export const designConceptSchema = aspectsSchema.extend({
  name: z.string().min(1).max(80),
  whySells: z.string().min(1).max(200),
});
export type DesignConcept = z.infer<typeof designConceptSchema>;

function extractJsonArray(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

export type GenerateConceptsInput = {
  niche?: string;
  targetCustomer?: string;
  count?: number;
  lockDesignType?: DesignType;
  textModel?: string;
};

/**
 * Generates a batch of t-shirt design concepts (angle/designType/archetype/
 * on-shirt copy/aspects) via one text-generation call, following
 * tshirt-design-concepts.md's methodology — no image is generated here, so
 * a concept can be inspected or edited before any image-gen call is spent
 * on it (see createDesignBatch in design-batches.ts). `niche`/
 * `targetCustomer` default from the store's own persona
 * (Store.audience/tone/brief — see AGENTS.md) when the caller doesn't
 * override them, since every store already carries this.
 */
export async function generateDesignConcepts(
  store: Store,
  input: GenerateConceptsInput
): Promise<DesignConcept[]> {
  const niche = input.niche?.trim() || store.audience?.trim() || "";
  if (!niche) {
    throw new StoreError(
      "MISSING_NICHE",
      "No niche/target customer to generate concepts for — pass `niche`, or set this store's `audience` first.",
      { status: 422, field: "niche" }
    );
  }
  const targetCustomer = input.targetCustomer?.trim() || store.audience?.trim() || niche;
  const tone = store.tone?.trim();
  const brief = (store.brief as Record<string, unknown>) ?? {};
  const count = Math.min(Math.max(input.count ?? 5, 1), 5);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new StoreError("MISSING_PROVIDER_CREDENTIALS", "OPENROUTER_API_KEY is not configured.", {
      status: 422,
    });
  }

  const briefLines = Object.entries(brief)
    .filter(([, v]) => v != null && v !== "" && (!Array.isArray(v) || v.length > 0))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join("; ") : String(v)}`)
    .join("\n");

  // The markdown methodology only spells out the hook/designType/archetype/
  // distressLevel tables in prose — every other field (layout, artStyle,
  // colorScheme, complexity, designedForShade, printRatio, placement) has
  // no legal-values list anywhere else the model can see, so without this
  // it guesses plausible-sounding strings that don't match aspectsSchema's
  // strict enums and every concept fails validation below. This is the
  // one place those exact enum values are ever true, so it's built from
  // DESIGN_VOCABULARY rather than duplicated by hand.
  const vocabularyLines = Object.entries(DESIGN_VOCABULARY)
    .filter(([key]) => key !== "version")
    .map(([key, values]) => `- ${key}: ${(values as readonly string[]).join(", ")}`)
    .join("\n");

  const prompt = [
    SKILL_MARKDOWN,
    "---",
    `Every field in the output JSON must use ONLY these exact legal values (case-sensitive):\n${vocabularyLines}`,
    `Niche: ${niche}`,
    `Target customer: ${targetCustomer}`,
    tone ? `Brand tone: ${tone}` : "",
    briefLines ? `Brand/business notes:\n${briefLines}` : "",
    input.lockDesignType
      ? `Use designType "${input.lockDesignType}" for every concept in this batch — get variety from hook/archetype instead.`
      : "",
    `Produce exactly ${count} concepts, each using a different hook and archetype where possible.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let raw: string;
  try {
    raw = await generateTextWithOpenRouter({
      apiKey,
      model: input.textModel || DEFAULT_TEXT_MODEL,
      prompt,
    });
  } catch (cause) {
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `Couldn't generate design concepts: ${cause instanceof Error ? cause.message : String(cause)}`,
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(raw));
  } catch (cause) {
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `Concept generation didn't return valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      { status: 502, details: { raw } }
    );
  }
  if (!Array.isArray(parsed)) {
    throw new StoreError("AI_PROVIDER_ERROR", "Concept generation didn't return a JSON array.", {
      status: 502,
      details: { raw },
    });
  }

  const concepts: DesignConcept[] = [];
  const rejected: Array<{ index: number; issues: string[] }> = [];
  parsed.forEach((item, index) => {
    const result = designConceptSchema.safeParse(item);
    if (result.success) {
      concepts.push(result.data);
    } else {
      rejected.push({
        index,
        issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
  });

  if (concepts.length === 0) {
    const sample = rejected[0];
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `None of the generated concepts passed validation — e.g. concept ${sample.index}: ${sample.issues.join("; ")}`,
      { status: 502, details: { rejected, raw } }
    );
  }

  return concepts.slice(0, count);
}
