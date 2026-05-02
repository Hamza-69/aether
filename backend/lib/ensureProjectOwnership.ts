import { prisma } from "./prisma"

/**
 * Verifies that a project exists AND belongs to the given user.
 *
 * Returns the project record if ownership is confirmed, or `null` otherwise.
 * Controllers should respond with 404 (not 403) when null — this avoids
 * leaking the existence of projects owned by other users.
 */
export async function ensureProjectOwnership(
  projectId: string,
  userId: string,
) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  })
}
