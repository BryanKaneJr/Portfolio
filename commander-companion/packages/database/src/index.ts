/**
 * @cc/database — the single Prisma client instance and typed data-access
 * helpers. All persistence goes through here so external callers never import
 * `@prisma/client` directly (keeps the client swappable and testable — CLAUDE.md).
 *
 * NOTE: The generated Prisma client is produced by `pnpm db:generate` from
 * `prisma/schema.prisma`. Until generated, the import below will not resolve;
 * this is expected on a fresh checkout. See docs/DATABASE.md.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Process-wide singleton to avoid exhausting connections during dev HMR. */
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient } from "@prisma/client";
