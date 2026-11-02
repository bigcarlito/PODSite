import { withAgentAuth } from "@/lib/store/api-helpers";
import { readCalibrations, saveFactoryCalibration } from "@/lib/store/factory-calibration";
export const GET = withAgentAuth(async (_request, store) => Response.json({ profiles: readCalibrations(store) }));
export const PUT = withAgentAuth(async (request, store) => Response.json(await saveFactoryCalibration(store, await request.json(), "agent")));
