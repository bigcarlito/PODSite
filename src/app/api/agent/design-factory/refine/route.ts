import { withAgentAuth } from "@/lib/store/api-helpers";
import { refineFactoryPrompt } from "@/lib/store/factory-review";
export const POST = withAgentAuth(async (request, store) => Response.json(await refineFactoryPrompt(store, await request.json(), "agent")));
