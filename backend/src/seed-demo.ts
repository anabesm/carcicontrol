import { seedDemoAdmin } from "./demo/seed-admin";
import { prisma } from "./lib/prisma";

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O seed de demonstração deve ser executado em ambiente local.");
  }

  const result = await seedDemoAdmin(prisma, {
    nome: process.env.DEMO_ADMIN_NAME,
    email: process.env.DEMO_ADMIN_EMAIL,
    senha: process.env.DEMO_ADMIN_PASSWORD,
  });
  console.info(result.created
    ? "Administrador de demonstração criado."
    : "Administrador já existente; dados e senha preservados.");
}

void seed().catch((error: unknown) => {
  console.error(error instanceof Error && error.name === "HttpError"
    ? error.message : "Não foi possível preparar o administrador. Verifique a configuração e o banco.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
