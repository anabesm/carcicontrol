import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

export const prisma = new PrismaClient({
  datasourceUrl: env.databaseUrl,
});

export async function checkDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
