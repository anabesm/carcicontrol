const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { createApp } = require("../dist/app.js");

async function requestHealth(checkDatabase) {
  const server = createApp(checkDatabase).listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("GET /health retorna 200 quando o banco responde", async () => {
  let databaseChecked = false;
  const result = await requestHealth(async () => {
    databaseChecked = true;
  });

  assert.equal(databaseChecked, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok", database: "up" });
});

test("GET /health retorna 503 sem expor detalhes da falha do banco", async () => {
  const result = await requestHealth(async () => {
    throw new Error("Detalhes internos da conexão");
  });

  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { status: "error", database: "down" });
});
