import { prisma } from "./lib/prisma";
import { HttpError } from "./lib/http-error";
import { seedDemoMedicoes } from "./demo/seed-medicoes";

async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new HttpError(400, "O seed de demonstração deve ser executado em ambiente local.");
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email)
    throw new HttpError(
      400,
      "Defina DEMO_ADMIN_EMAIL para identificar o administrador da demonstração.",
    );
  const admin = await prisma.usuario.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      perfil: "ADMINISTRADOR",
      status: "ATIVO",
    },
    select: { id: true },
  });
  if (!admin) throw new HttpError(400, "Prepare primeiro o administrador de demonstração.");
  const result = await seedDemoMedicoes(prisma, admin.id);
  console.info(
    `Demonstração preparada: ${result.parametersCreated} parâmetros e ${result.rangesCreated} faixas criados. Configurações existentes preservadas.`,
  );
}
void seed()
  .catch((error: unknown) => {
    console.error(
      error instanceof HttpError
        ? error.message
        : "Não foi possível preparar as faixas de demonstração. Verifique a configuração e o banco.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
