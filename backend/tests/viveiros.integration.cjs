const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../dist/app.js");
const { seedDemoAdmin } = require("../dist/demo/seed-admin.js");
const { hashPassword } = require("../dist/auth/password.js");
const { openCycle } = require("../dist/viveiros/service.js");
const { validateNewCycle } = require("../dist/viveiros/validation.js");
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
const prefix = `viveiros-${randomUUID()}`;
const fixtureEmails = [`${prefix}-admin@example.test`, `${prefix}-employee@example.test`];
const fixtureIdentifiers = new Set();
const password = `Senha-${randomUUID()}`;
const stocking = { dataInicio: "2026-10-28", qtdLarvasInicial: 120000, fornecedorLarvas: "Laboratório de teste", previsaoDespesca: "2027-02-28" };
let server;
let baseUrl;
let admin;
let adminCookie;
let employeeCookie;

function identifier(name) {
  const value = `${prefix}-${name}`;
  fixtureIdentifiers.add(value);
  return value;
}

async function request(route, { method = "GET", cookie, body } = {}) {
  if (route === "/viveiros" && method === "POST" && typeof body?.identificador === "string") {
    fixtureIdentifiers.add(body.identificador.trim());
  }
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${route}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  return { response, body: response.status === 204 ? null : await response.json() };
}

async function login(email) {
  const result = await request("/auth/login", { method: "POST", body: { email, senha: password } });
  assert.equal(result.response.status, 200);
  return result.response.headers.get("set-cookie").split(";")[0];
}

async function createPond(name) {
  const result = await request("/viveiros", {
    method: "POST", cookie: adminCookie,
    body: { identificador: identifier(name), area: 1500, profundidadeMedia: 1.5, localizacao: "Setor de teste" },
  });
  assert.equal(result.response.status, 201);
  return result.body.viveiro;
}

before(async () => {
  execFileSync(process.execPath, [path.resolve(__dirname, "../node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    cwd: path.resolve(__dirname, ".."), env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "pipe", windowsHide: true,
  });
  await db.$connect();
  admin = (await seedDemoAdmin(db, { nome: "Administrador de Teste", email: fixtureEmails[0], senha: password })).usuario;
  await db.usuario.create({ data: {
    nome: "Funcionário de Teste", email: fixtureEmails[1], senha: await hashPassword(password),
    perfil: "FUNCIONARIO", criadoPor: admin.id,
  } });
  server = createApp(async () => { await db.$queryRaw`SELECT 1`; }, {
    db, session: { ttlMs: 60 * 60 * 1000, secure: false },
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  adminCookie = await login(fixtureEmails[0]);
  employeeCookie = await login(fixtureEmails[1]);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    const ponds = await db.viveiro.findMany({ where: { identificador: { in: [...fixtureIdentifiers] } }, select: { id: true } });
    const ids = ponds.map((pond) => pond.id);
    await db.cicloCultivo.deleteMany({ where: { viveiroId: { in: ids } } });
    await db.viveiro.deleteMany({ where: { id: { in: ids } } });
    await db.usuario.deleteMany({ where: { email: { in: fixtureEmails } } });
  } finally { await db.$disconnect(); }
});

test("consultas e operações de viveiros exigem autenticação", async () => {
  for (const [route, method] of [["/viveiros", "GET"], ["/viveiros/1", "GET"], ["/viveiros", "POST"], ["/viveiros/1/ciclos", "POST"]]) {
    const result = await request(route, { method });
    assert.equal(result.response.status, 401);
  }
});

test("administrador cadastra viveiro disponível e ambos os perfis consultam seus dados", async () => {
  const pond = await createPond("consulta");
  assert.equal(pond.status, "DISPONIVEL");
  assert.equal(pond.cicloAtivo, null);
  assert.equal(pond.totalCiclos, 0);
  for (const cookie of [adminCookie, employeeCookie]) {
    const list = await request("/viveiros", { cookie });
    assert.equal(list.response.status, 200);
    assert.deepEqual(list.body.viveiros.find((row) => row.id === pond.id), pond);
    const detail = await request(`/viveiros/${pond.id}`, { cookie });
    assert.equal(detail.response.status, 200);
    assert.deepEqual(detail.body.viveiro, { ...pond, ciclos: [] });
  }
});

test("funcionário não cadastra viveiro nem abre ciclo, mesmo enviando perfil administrativo", async () => {
  const pond = await createPond("permissao");
  const forbiddenPond = await request("/viveiros", {
    method: "POST", cookie: employeeCookie,
    body: { identificador: identifier("forbidden"), area: 1500, profundidadeMedia: 1.5, perfil: "ADMINISTRADOR" },
  });
  assert.equal(forbiddenPond.response.status, 403);
  const forbiddenCycle = await request(`/viveiros/${pond.id}/ciclos`, {
    method: "POST", cookie: employeeCookie, body: { ...stocking, perfil: "ADMINISTRADOR" },
  });
  assert.equal(forbiddenCycle.response.status, 403);
  assert.equal(await db.viveiro.count({ where: { identificador: `${prefix}-forbidden` } }), 0);
  assert.equal(await db.cicloCultivo.count({ where: { viveiroId: pond.id } }), 0);
  assert.equal((await db.viveiro.findUniqueOrThrow({ where: { id: pond.id } })).status, "DISPONIVEL");
});

test("identificadores duplicados são recusados com diferenças de caixa e espaços", async () => {
  const pond = await createPond("duplicado");
  for (const value of [pond.identificador, ` ${pond.identificador.toUpperCase()} `]) {
    const duplicate = await request("/viveiros", {
      method: "POST", cookie: adminCookie, body: { identificador: value, area: 2000, profundidadeMedia: 2 },
    });
    assert.equal(duplicate.response.status, 409);
  }
  await assert.rejects(db.viveiro.create({ data: {
    identificador: ` ${pond.identificador.toUpperCase()} `, area: 2000, profundidadeMedia: 2,
  } }), (error) => error.code === "P2002");
  assert.equal((await db.viveiro.findUniqueOrThrow({ where: { id: pond.id } })).area, 1500);
});

test("cadastros concorrentes de identificadores equivalentes criam um único viveiro", async () => {
  const value = identifier("concorrente-cadastro");
  const results = await Promise.all([value, value.toUpperCase(), ` ${value} `, ` ${value.toUpperCase()} `].map((identificador) => request("/viveiros", {
    method: "POST", cookie: adminCookie, body: { identificador, area: 1500, profundidadeMedia: 1.5 },
  })));
  assert.deepEqual(results.map((result) => result.response.status).sort(), [201, 409, 409, 409]);
  assert.equal(await db.viveiro.count({ where: { identificador: { equals: value, mode: "insensitive" } } }), 1);
});

test("API rejeita dados inválidos, IDs inválidos e recursos inexistentes", async () => {
  const pond = await createPond("validacao");
  for (const body of [{}, { identificador: identifier("invalid"), area: -1, profundidadeMedia: 1.5 }, { identificador: identifier("status"), area: 1500, profundidadeMedia: 1.5, status: "OCUPADO" }]) {
    assert.equal((await request("/viveiros", { method: "POST", cookie: adminCookie, body })).response.status, 400);
  }
  for (const body of [{}, { ...stocking, qtdLarvasInicial: 1.5 }, { ...stocking, dataInicio: "2026-02-30" }, { ...stocking, previsaoDespesca: "2026-10-27" }, { ...stocking, criadoPor: 999 }]) {
    assert.equal((await request(`/viveiros/${pond.id}/ciclos`, { method: "POST", cookie: adminCookie, body })).response.status, 400);
  }
  for (const value of ["abc", "0", "-1", "2147483648"]) {
    assert.equal((await request(`/viveiros/${value}`, { cookie: employeeCookie })).response.status, 400);
    assert.equal((await request(`/viveiros/${value}/ciclos`, { method: "POST", cookie: adminCookie, body: stocking })).response.status, 400);
  }
  await db.viveiro.delete({ where: { id: pond.id } });
  assert.equal((await request(`/viveiros/${pond.id}`, { cookie: adminCookie })).response.status, 404);
  assert.equal((await request(`/viveiros/${pond.id}/ciclos`, { method: "POST", cookie: adminCookie, body: stocking })).response.status, 404);
});

test("abertura registra povoamento e autoria do servidor e impede um segundo ciclo", async () => {
  const pond = await createPond("abertura");
  const result = await request(`/viveiros/${pond.id}/ciclos`, { method: "POST", cookie: adminCookie, body: stocking });
  assert.equal(result.response.status, 201);
  const cycle = result.body.ciclo;
  assert.equal(cycle.viveiroId, pond.id);
  assert.equal(cycle.status, "ATIVO");
  assert.equal(cycle.criadoPor, admin.id);
  assert.equal(cycle.dataInicio, "2026-10-28T00:00:00.000Z");
  assert.equal(cycle.previsaoDespesca, "2027-02-28T00:00:00.000Z");
  assert.equal(cycle.qtdLarvasInicial, stocking.qtdLarvasInicial);
  assert.equal(cycle.fornecedorLarvas, stocking.fornecedorLarvas);
  assert.equal(cycle.dataEncerramento, null);
  assert.equal(cycle.pesoFinal, null);
  assert.equal((await db.viveiro.findUniqueOrThrow({ where: { id: pond.id } })).status, "OCUPADO");
  const repeat = await request(`/viveiros/${pond.id}/ciclos`, { method: "POST", cookie: adminCookie, body: stocking });
  assert.equal(repeat.response.status, 409);
  assert.equal(await db.cicloCultivo.count({ where: { viveiroId: pond.id } }), 1);
  const list = await request("/viveiros", { cookie: employeeCookie });
  assert.deepEqual(list.body.viveiros.find((row) => row.id === pond.id).cicloAtivo, cycle);
  await assert.rejects(db.cicloCultivo.create({ data: {
    ...validateNewCycle(stocking), viveiroId: pond.id, criadoPor: admin.id,
  } }), (error) => error.code === "P2002");
});

test("solicitações simultâneas abrem exatamente um ciclo e mantêm a ocupação consistente", async () => {
  const pond = await createPond("concorrente-abertura");
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => request(`/viveiros/${pond.id}/ciclos`, {
    method: "POST", cookie: adminCookie, body: { ...stocking, qtdLarvasInicial: 120000 + index },
  })));
  assert.deepEqual(results.map((result) => result.response.status).sort(), [201, 409, 409, 409, 409, 409, 409, 409]);
  const winner = results.find((result) => result.response.status === 201).body.ciclo;
  assert.equal(await db.cicloCultivo.count({ where: { viveiroId: pond.id, status: "ATIVO" } }), 1);
  const detail = await request(`/viveiros/${pond.id}`, { cookie: employeeCookie });
  assert.equal(detail.body.viveiro.status, "OCUPADO");
  assert.deepEqual(detail.body.viveiro.cicloAtivo, winner);
  assert.equal(detail.body.viveiro.totalCiclos, 1);
});

test("viveiro em manutenção, inativo ou ocupado não permite abertura", async () => {
  for (const status of ["MANUTENCAO", "INATIVO", "OCUPADO"]) {
    const pond = await createPond(`indisponivel-${status}`);
    await db.viveiro.update({ where: { id: pond.id }, data: { status } });
    const result = await request(`/viveiros/${pond.id}/ciclos`, { method: "POST", cookie: adminCookie, body: stocking });
    assert.equal(result.response.status, 409);
    assert.equal(await db.cicloCultivo.count({ where: { viveiroId: pond.id } }), 0);
    assert.equal((await db.viveiro.findUniqueOrThrow({ where: { id: pond.id } })).status, status);
  }
});

test("ciclo ativo impede abertura mesmo quando o status legado do viveiro está disponível", async () => {
  const pond = await createPond("legado-ativo");
  await db.cicloCultivo.create({ data: { ...validateNewCycle(stocking), viveiroId: pond.id, criadoPor: admin.id } });
  const result = await request(`/viveiros/${pond.id}/ciclos`, { method: "POST", cookie: adminCookie, body: stocking });
  assert.equal(result.response.status, 409);
  assert.equal(await db.cicloCultivo.count({ where: { viveiroId: pond.id } }), 1);
});

test("histórico inclui todos os ciclos em ordem estável e é preservado ao abrir outro ciclo", async () => {
  const pond = await createPond("historico");
  const oldIds = [];
  for (const [status, dataInicio] of [["FINALIZADO", "2026-01-01"], ["CANCELADO", "2026-02-01"], ["FINALIZADO", "2026-02-01"]]) {
    const cycle = await db.cicloCultivo.create({ data: {
      ...validateNewCycle({ dataInicio, qtdLarvasInicial: 100000 }),
      viveiroId: pond.id, criadoPor: admin.id, status, dataEncerramento: new Date("2026-04-01T00:00:00Z"),
    } });
    oldIds.push(cycle.id);
  }
  const before = await db.cicloCultivo.findMany({ where: { id: { in: oldIds } }, orderBy: { id: "asc" } });
  const open = await request(`/viveiros/${pond.id}/ciclos`, { method: "POST", cookie: adminCookie, body: stocking });
  assert.equal(open.response.status, 201);
  for (const cookie of [adminCookie, employeeCookie]) {
    const detail = await request(`/viveiros/${pond.id}`, { cookie });
    assert.equal(detail.response.status, 200);
    assert.deepEqual(detail.body.viveiro.ciclos.map((cycle) => cycle.id), [open.body.ciclo.id, ...oldIds.toReversed()]);
    assert.equal(detail.body.viveiro.totalCiclos, 4);
    assert.equal(detail.body.viveiro.cicloAtivo.id, open.body.ciclo.id);
  }
  assert.deepEqual(await db.cicloCultivo.findMany({ where: { id: { in: oldIds } }, orderBy: { id: "asc" } }), before);
});

test("falha na gravação do ciclo desfaz a alteração de ocupação do viveiro", async () => {
  const pond = await createPond("rollback");
  // Provoca uma falha de persistência após disputar o viveiro, sem alterar dados externos à fixture.
  await assert.rejects(openCycle(db, pond.id, validateNewCycle(stocking), 2147483648));
  assert.equal((await db.viveiro.findUniqueOrThrow({ where: { id: pond.id } })).status, "DISPONIVEL");
  assert.equal(await db.cicloCultivo.count({ where: { viveiroId: pond.id } }), 0);
});
