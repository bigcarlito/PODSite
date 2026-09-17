import "server-only";
import type { Store } from "@prisma/client";
import { logActivity, type ActivityActor } from "@/lib/store/activity";
import { createDesign } from "./designs";
import { generateDesignConcepts, designConceptSchema, type DesignConcept } from "./concepts";
import type { DesignType } from "./aspects";

/** Matches the skill's own batch default (see tshirt-design-concepts.md) —
 * also bounds the cost of one batch call, since each concept spends at
 * least one image generation. */
const MAX_BATCH_SIZE = 5;

export type CreateDesignBatchInput = {
  /** Concepts to use as-is (e.g. an agent's edited output from
   * generateDesignConcepts) — skips concept generation entirely. */
  concepts?: unknown[];
  niche?: string;
  targetCustomer?: string;
  count?: number;
  lockDesignType?: DesignType;
  /** Garment product type these concepts target — stored on each Design's
   * params so the one-click "make product" flow knows which MockupScene/
   * default price to use later without asking again. */
  productType?: string;
  provider?: string;
  model?: string;
  textModel?: string;
};

export type DesignBatchResult = {
  concept: DesignConcept;
  design?: Awaited<ReturnType<typeof createDesign>>;
  error?: string;
};

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "batch"
  );
}

/**
 * Turns a batch of design concepts — either supplied directly or freshly
 * generated from a niche/targetCustomer — into real Designs via the
 * existing createDesign pipeline (QC gate, upscale, all unchanged; see
 * AGENTS.md's "structured designs" notes). Every design in the run shares
 * one batchLabel so /admin/designs (and GET /api/agent/designs?status=)
 * can review it as one set. A concept that fails image generation doesn't
 * abort the rest of the batch — its failure is returned alongside the
 * successes, both for visibility and because a design that failed QC
 * twice is still evidence of an expensive aspect combination.
 */
export async function createDesignBatch(
  store: Store,
  input: CreateDesignBatchInput,
  actor: ActivityActor,
  origin: string
): Promise<{ batchLabel: string; productType: string; results: DesignBatchResult[] }> {
  const productType = input.productType?.trim() || "tshirt";

  let concepts: DesignConcept[];
  if (input.concepts && input.concepts.length > 0) {
    concepts = designConceptSchema.array().parse(input.concepts);
  } else {
    concepts = await generateDesignConcepts(store, {
      niche: input.niche,
      targetCustomer: input.targetCustomer,
      count: input.count,
      lockDesignType: input.lockDesignType,
      textModel: input.textModel,
    });
  }
  concepts = concepts.slice(0, MAX_BATCH_SIZE);

  const batchLabel = `${slugify(input.niche || store.audience || "batch")}-${Date.now()}`;

  const results: DesignBatchResult[] = [];
  for (const concept of concepts) {
    const { name, whySells, ...aspects } = concept;
    try {
      const design = await createDesign(
        store,
        {
          aspects,
          provider: input.provider || "openrouter",
          model: input.model,
          batchLabel,
          meta: { name, whySells, targetProductType: productType },
        },
        actor,
        origin
      );
      results.push({ concept, design });
    } catch (cause) {
      results.push({ concept, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  await logActivity(store.id, {
    actor,
    category: "design",
    summary: `Generated a batch of ${concepts.length} t-shirt concept(s) (batch "${batchLabel}")`,
    details: {
      batchLabel,
      productType,
      niche: input.niche,
      succeeded: results.filter((r) => r.design).length,
      failed: results.filter((r) => r.error).length,
    },
  });

  return { batchLabel, productType, results };
}
