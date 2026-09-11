import { withAgentAuth } from "@/lib/store/api-helpers";
import { DESIGN_VOCABULARY } from "@/lib/design/aspects";

export const dynamic = "force-dynamic";

export const GET = withAgentAuth(async () => {
  return Response.json(DESIGN_VOCABULARY);
});
