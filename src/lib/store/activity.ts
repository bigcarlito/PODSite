import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ActivityActor = "agent" | "admin" | "customer" | "system";

export function logActivity(
  storeId: string,
  entry: {
    actor: ActivityActor;
    category: string;
    summary: string;
    details?: Record<string, unknown>;
  }
) {
  return prisma.activityLogEntry.create({
    data: {
      storeId,
      actor: entry.actor,
      category: entry.category,
      summary: entry.summary,
      details: entry.details as Prisma.InputJsonValue | undefined,
    },
  });
}

export function listActivity(
  storeId: string,
  opts?: { since?: Date; take?: number }
) {
  return prisma.activityLogEntry.findMany({
    where: { storeId, ...(opts?.since ? { createdAt: { gte: opts.since } } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 50,
  });
}
