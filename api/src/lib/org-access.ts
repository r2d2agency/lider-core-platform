import { prisma } from "../prisma.js";

export async function isSuperUser(userId: string) {
  const role = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
    select: { id: true },
  });
  return !!role;
}

export async function assertOrgAccess(userId: string, orgId: string) {
  if (await isSuperUser(userId)) return true;
  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId: orgId },
    select: { id: true },
  });
  return !!membership;
}

export async function resolveOrgContext(userId: string, requestedOrgId?: string | null) {
  if (requestedOrgId) {
    const allowed = await assertOrgAccess(userId, requestedOrgId);
    return allowed ? requestedOrgId : null;
  }

  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
}
