import { withAgentAuth } from "@/lib/store/api-helpers";
import { generateFactoryRevision } from "@/lib/store/factory-review";
export const POST = withAgentAuth(async (request, store) => Response.json(await generateFactoryRevision(store, await request.json(), "agent")));
