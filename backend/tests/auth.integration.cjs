const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../dist/app.js");
const { hashPassword, verifyPassword } = require("../dist/auth/password.js");
const { hashSessionToken } = require("../dist/auth/session.js");
const { seedDemoAdmin } = require("../dist/demo/seed-admin.js");
require("dotenv/config");

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test")) {
  throw new Error("Defina TEST_DATABASE_URL para um banco separado cujo nome termine em _test.");
}
if (process.env.DATABASE_URL) {
  const current = new URL(process.env.DATABASE_URL);
  const target = new URL(testUrl);
  if (current.host === target.host && current.pathname === target.pathname) {
    throw new Error("O banco de integração deve ser diferente do banco da aplicação.");
  }
}

const db = new PrismaClient({ datasourceUrl: testUrl });
const prefix = `auth-${randomUUID()}`;
const password = `Senha-${randomUUID()}`;
const fixtureEmails = new Set();
const email = (name) => {
  const value = `${prefix}-${name}@example.test`;
  fixtureEmails.add(value);
  return value;
};
let server;
let baseUrl;
let admin;
let employee;

async function request(path, { method = "GET", cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  return { response, body: response.status === 204 ? null : await response.json() };
}

async function login(user) {
  const result = await request("/auth/login", {
    method: "POST", body: { email: user.email, senha: password },
  });
  assert.equal(result.response.status, 200);
  const header = result.response.headers.get("set-cookie");
  assert.ok(header);
  return { ...result, cookie: header.split(";")[0], header };
}

function assertPublicUser(user) {
  assert.deepEqual(Object.keys(user).sort(), ["id", "nome", "email", "telefone", "perfil", "status", "criadoEm"].sort());
  assert.equal(Object.hasOwn(user, "senha"), false);
  assert.equal(Object.hasOwn(user, "tokenHash"), false);
}

before(async () => {
  execFileSync(process.execPath, [path.resolve(__dirname, "../node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    cwd: path.resolve(__dirname, ".."), env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "pipe", windowsHide: true,
  });
  await db.$connect();
  const result = await seedDemoAdmin(db, { nome: "Administrador Teste", email: email("admin"), senha: password });
  admin = result.usuario;
  employee = await db.usuario.create({
    data: {
      nome: "Funcionário Teste", email: email("employee"), senha: await hashPassword(password),
      perfil: "FUNCIONARIO", criadoPor: admin.id,
    },
  });
  server = createApp(async () => { await db.$queryRaw`SELECT 1`; }, {
    db, session: { ttlMs: 60 * 60 * 1000, secure: false },
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    await db.usuario.deleteMany({ where: { email: { in: [...fixtureEmails] } } });
  } finally {
    await db.$disconnect();
  }
});

test("credenciais incorretas e usuário inexistente retornam o mesmo erro", async () => {
  const wrong = await request("/auth/login", {
    method: "POST", body: { email: admin.email, senha: "Senha incorreta" },
  });
  const unknown = await request("/auth/login", {
    method: "POST", body: { email: email("unknown"), senha: "Senha incorreta" },
  });
  assert.equal(wrong.response.status, 401);
  assert.equal(unknown.response.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.equal(wrong.response.headers.get("set-cookie"), null);
});

test("rotas protegidas rejeitam acesso sem sessão ou com cookie inválido", async () => {
  for (const [path, method] of [["/auth/me", "GET"], ["/auth/logout", "POST"], ["/usuarios", "GET"], ["/usuarios", "POST"]]) {
    const result = await request(path, { method });
    assert.equal(result.response.status, 401);
  }
  const malformed = await request("/auth/me", { cookie: "carcicontrol_session=invalida" });
  assert.equal(malformed.response.status, 401);
  const forged = await request("/auth/me", { cookie: `carcicontrol_session=${"a".repeat(64)}` });
  assert.equal(forged.response.status, 401);
});

test("login e consulta autenticada retornam somente dados públicos e cookie protegido", async () => {
  const result = await login(admin);
  assertPublicUser(result.body.usuario);
  assert.match(result.header, /HttpOnly/i);
  assert.match(result.header, /SameSite=Lax/i);
  assert.match(result.header, /Path=\//i);
  assert.match(result.header, /Expires=/i);
  assert.equal(result.response.headers.get("cache-control"), "no-store");
  const token = result.cookie.split("=")[1];
  const session = await db.sessaoUsuario.findUnique({ where: { tokenHash: hashSessionToken(token) } });
  assert.ok(session);
  assert.notEqual(session.tokenHash, token);
  const me = await request("/auth/me", { cookie: result.cookie });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.usuario.id, admin.id);
  assert.equal(me.body.usuario.perfil, "ADMINISTRADOR");
  assertPublicUser(me.body.usuario);
});

test("administrador cadastra funcionário com hash e lista somente funcionários", async () => {
  const { cookie } = await login(admin);
  const userEmail = email("new");
  const result = await request("/usuarios", {
    method: "POST", cookie,
    body: { nome: "Novo Funcionário", email: ` ${userEmail.toUpperCase()} `, senha: password, telefone: "85999999999" },
  });
  assert.equal(result.response.status, 201);
  assertPublicUser(result.body.usuario);
  assert.equal(result.body.usuario.email, userEmail);
  assert.equal(result.body.usuario.perfil, "FUNCIONARIO");
  const stored = await db.usuario.findUniqueOrThrow({ where: { email: userEmail } });
  assert.notEqual(stored.senha, password);
  assert.equal(await verifyPassword(password, stored.senha), true);
  assert.equal(stored.criadoPor, admin.id);
  const list = await request("/usuarios", { cookie });
  assert.equal(list.response.status, 200);
  assert.ok(list.body.usuarios.some((user) => user.id === stored.id));
  assert.ok(list.body.usuarios.every((user) => user.perfil === "FUNCIONARIO"));
  list.body.usuarios.forEach(assertPublicUser);
});

test("cadastro rejeita campos inválidos, privilégio enviado pelo cliente e e-mail duplicado", async () => {
  const { cookie } = await login(admin);
  for (const body of [
    {},
    { nome: "Nome", email: "invalido", senha: password },
    { nome: "Nome", email: email("short"), senha: "123" },
    { nome: "Nome", email: email("escalation"), senha: password, perfil: "ADMINISTRADOR" },
  ]) {
    const result = await request("/usuarios", { method: "POST", cookie, body });
    assert.equal(result.response.status, 400);
  }
  const duplicate = await request("/usuarios", {
    method: "POST", cookie, body: { nome: "Duplicado", email: employee.email.toUpperCase(), senha: password },
  });
  assert.equal(duplicate.response.status, 409);
});

test("cadastros simultâneos com o mesmo e-mail criam um único funcionário", async () => {
  const { cookie } = await login(admin);
  const userEmail = email("concurrent");
  const results = await Promise.all([1, 2].map(() => request("/usuarios", {
    method: "POST", cookie, body: { nome: "Concorrente", email: userEmail, senha: password },
  })));
  assert.deepEqual(results.map((result) => result.response.status).sort(), [201, 409]);
  assert.equal(await db.usuario.count({ where: { email: userEmail } }), 1);
});

test("funcionário consulta sua sessão mas não pode cadastrar nem listar usuários", async () => {
  const { cookie } = await login(employee);
  const me = await request("/auth/me", { cookie });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.usuario.perfil, "FUNCIONARIO");
  assertPublicUser(me.body.usuario);
  const list = await request("/usuarios", { cookie });
  assert.equal(list.response.status, 403);
  const create = await request("/usuarios", {
    method: "POST", cookie,
    body: { nome: "Tentativa", email: email("forbidden"), senha: password, perfil: "ADMINISTRADOR" },
  });
  assert.equal(create.response.status, 403);
});

test("usuário inativado perde a sessão e não consegue fazer login", async () => {
  const { cookie } = await login(employee);
  await db.usuario.update({ where: { id: employee.id }, data: { status: "INATIVO" } });
  try {
    const me = await request("/auth/me", { cookie });
    assert.equal(me.response.status, 401);
    const result = await request("/auth/login", { method: "POST", body: { email: employee.email, senha: password } });
    assert.equal(result.response.status, 401);
  } finally {
    await db.usuario.update({ where: { id: employee.id }, data: { status: "ATIVO" } });
  }
});

test("sessão expirada é rejeitada e removida do banco", async () => {
  const { cookie } = await login(employee);
  const tokenHash = hashSessionToken(cookie.split("=")[1]);
  await db.sessaoUsuario.update({ where: { tokenHash }, data: { expiraEm: new Date(Date.now() - 1000) } });
  const result = await request("/auth/me", { cookie });
  assert.equal(result.response.status, 401);
  assert.equal(await db.sessaoUsuario.count({ where: { tokenHash } }), 0);
});

test("logout remove a sessão e impede reutilizar o cookie anterior", async () => {
  const { cookie } = await login(admin);
  const tokenHash = hashSessionToken(cookie.split("=")[1]);
  const result = await request("/auth/logout", { method: "POST", cookie });
  assert.equal(result.response.status, 204);
  assert.match(result.response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/i);
  assert.equal(await db.sessaoUsuario.count({ where: { tokenHash } }), 0);
  const replay = await request("/auth/me", { cookie });
  assert.equal(replay.response.status, 401);
});

test("seed repetido preserva o administrador e não promove funcionário existente", async () => {
  const before = await db.usuario.findUniqueOrThrow({ where: { id: admin.id } });
  const repeated = await seedDemoAdmin(db, {
    nome: "Nome alterado", email: admin.email, senha: "Outra senha de teste",
  });
  assert.equal(repeated.created, false);
  const preserved = await db.usuario.findUniqueOrThrow({ where: { id: admin.id } });
  assert.equal(preserved.nome, before.nome);
  assert.equal(preserved.senha, before.senha);
  await assert.rejects(seedDemoAdmin(db, {
    nome: "Não promover", email: employee.email, senha: password,
  }), /funcionário/);
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: employee.id } })).perfil, "FUNCIONARIO");
});
