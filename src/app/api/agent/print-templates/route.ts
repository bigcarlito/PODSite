import { withAgentAuth } from "@/lib/store/api-helpers";
import { listPrintTemplates } from "@/lib/design/print-templates";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async (_request, store) => {
  const printTemplates = await listPrintTemplates(store.id);
  return Response.json({ printTemplates });
});
