const assert = require("node:assert/strict");
const { test } = require("node:test");
const { hashPassword, verifyPassword } = require("../dist/auth/password.js");

test("senhas recebem salt exclusivo e aceitam caracteres Unicode", async () => {
  const password = "Senha de teste áç🔒";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("Senha incorreta", first), false);
});

test("hash inválido ou com parâmetros inesperados é rejeitado", async () => {
  assert.equal(await verifyPassword("Senha de teste", "texto-sem-hash"), false);
  const stored = await hashPassword("Senha de teste");
  assert.equal(await verifyPassword("Senha de teste", stored.replace("32768", "999999999")), false);
});
