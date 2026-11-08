import { withAgentAuth } from "@/lib/store/api-helpers";
import { createFactoryDraft } from "@/lib/store/factory-draft";
export const POST = withAgentAuth(async (request, store) => Response.json(await createFactoryDraft(store, await request.json(), "agent")));
