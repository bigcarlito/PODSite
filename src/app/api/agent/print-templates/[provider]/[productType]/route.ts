import { z } from "zod";
import { withAgentAuth } from "@/lib/store/api-helpers";
import { setPrintTemplate } from "@/lib/design/print-templates";
import { printTemplateUpsertSchema } from "@/lib/store/schemas";

export const dynamic = "force-dynamic";

const providerParamSchema = z.enum(["PRINTFUL", "PRINTIFY", "GELATO"]);

type Ctx = { params: Promise<{ provider: string; productType: string }> };

export const PUT = withAgentAuth(async (request, store, ctx: Ctx) => {
  const { provider: providerParam, productType } = await ctx.params;
  const provider = providerParamSchema.parse(providerParam.toUpperCase());
  const body = await request.json();
  const input = printTemplateUpsertSchema.parse(body);

  const printTemplate = await setPrintTemplate(
    store.id,
    provider,
    decodeURIComponent(productType),
    input,
    "agent"
  );
  return Response.json({ printTemplate });
});
