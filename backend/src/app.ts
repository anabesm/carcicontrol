import express from "express";

export function createApp(checkDatabase: () => Promise<void>) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", async (_request, response) => {
    response.set("Cache-Control", "no-store");

    try {
      await checkDatabase();
      response.status(200).json({ status: "ok", database: "up" });
    } catch {
      response.status(503).json({ status: "error", database: "down" });
    }
  });

  return app;
}
