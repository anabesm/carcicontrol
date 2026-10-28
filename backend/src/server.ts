import { createApp } from "./app";
import { env } from "./config/env";
import { checkDatabase, prisma } from "./lib/prisma";

async function start(): Promise<void> {
  await prisma.$connect();
  await checkDatabase();

  const app = createApp(checkDatabase);
  const server = app.listen(env.port, env.host, () => {
    console.info(`API disponível em http://${env.host}:${env.port}`);
  });

  server.on("error", () => {
    console.error("Não foi possível abrir a porta da API. Verifique HOST e PORT.");
    void prisma.$disconnect().finally(() => {
      process.exitCode = 1;
    });
  });

  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;

    const timeout = setTimeout(() => {
      console.error("O encerramento da API excedeu o tempo limite.");
      server.closeAllConnections();
      process.exit(1);
    }, 10_000);
    timeout.unref();

    server.close(() => {
      void prisma.$disconnect().then(
        () => {
          clearTimeout(timeout);
          process.exitCode = 0;
        },
        () => {
          clearTimeout(timeout);
          process.exitCode = 1;
        },
      );
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void start().catch(async () => {
  console.error("Não foi possível iniciar a API. Verifique a configuração e o PostgreSQL.");
  await prisma.$disconnect();
  process.exitCode = 1;
});
