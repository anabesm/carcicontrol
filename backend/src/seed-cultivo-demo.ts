import { prisma } from "./lib/prisma";
import { seedDemoCultivo } from "./demo/seed-cultivo";

async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Execute o seed de demonstração em ambiente local.");
  const email = process.env.DEMO_ADMIN_EMAIL;
  if (!email)
    throw new Error(
      "Configure DEMO_ADMIN_EMAIL e prepare o administrador de demonstração.",
    );
  const admin = await prisma.usuario.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      perfil: "ADMINISTRADOR",
      status: "ATIVO",
    },
    select: { id: true },
  });
  if (!admin)
    throw new Error("Prepare primeiro o administrador de demonstração.");
  const result = await seedDemoCultivo(prisma, admin.id);
  console.info(
    `Demonstração: ${result.created} viveiros criados e ${result.preserved} preservados.`,
  );
}
void seed()
  .catch(() => {
    console.error(
      "Não foi possível preparar a demonstração. Verifique o administrador, os parâmetros e o banco.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
