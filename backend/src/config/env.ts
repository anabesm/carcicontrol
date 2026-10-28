import "dotenv/config";

const portValue = process.env.PORT ?? "3000";
const port = Number(portValue);

if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número inteiro entre 1 e 65535.");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Defina DATABASE_URL no ambiente ou no arquivo .env.");
}

try {
  const parsed = new URL(databaseUrl);
  if (!["postgresql:", "postgres:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("Protocolo inválido.");
  }
} catch {
  throw new Error("DATABASE_URL deve ser uma URL válida de PostgreSQL.");
}

export const env = {
  host: process.env.HOST ?? "127.0.0.1",
  port,
  databaseUrl,
};
