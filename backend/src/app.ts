import type { PrismaClient } from "@prisma/client";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { createAuthRouter } from "./auth/routes";
import type { SessionOptions } from "./auth/session";
import { HttpError } from "./lib/http-error";
import { createUsuariosRouter } from "./usuarios/routes";
import { createViveirosRouter } from "./viveiros/routes";

export function createApp(checkDatabase: () => Promise<void>, auth?: {
  db: PrismaClient;
  session: SessionOptions;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  app.get("/health", async (_request, response) => {
    try {
      await checkDatabase();
      response.status(200).json({ status: "ok", database: "up" });
    } catch {
      response.status(503).json({ status: "error", database: "down" });
    }
  });

  app.use(express.json({ limit: "16kb" }));

  if (auth) {
    app.use("/auth", createAuthRouter(auth.db, auth.session));
    app.use("/usuarios", createUsuariosRouter(auth.db, auth.session));
    app.use("/viveiros", createViveirosRouter(auth.db, auth.session));
  }

  app.use((_request, response) => {
    response.status(404).json({ error: "Rota não encontrada." });
  });

  const handleError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message });
    } else if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "JSON inválido." });
    } else if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
      response.status(413).json({ error: "O corpo da requisição excedeu o limite permitido." });
    } else {
      response.status(500).json({ error: "Não foi possível concluir a operação." });
    }
  };
  app.use(handleError);

  return app;
}
