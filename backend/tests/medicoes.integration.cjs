const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../dist/app");
const { seedDemoAdmin } = require("../dist/demo/seed-admin");
const { seedDemoMedicoes } = require("../dist/demo/seed-medicoes");
const { hashPassword } = require("../dist/auth/password");
const { recordMedicao } = require("../dist/medicoes/service");
const { validateNewMedicao } = require("../dist/medicoes/validation");
const { supportedCodes } = require("../dist/medicoes/definitions");
require("dotenv/config");

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL em um banco separado terminado em _test.");
if (process.env.DATABASE_URL) {
  const main = new URL(process.env.DATABASE_URL);
  const target = new URL(testUrl);
  if (main.host === target.host && main.pathname === target.pathname) throw new Error("O banco de testes deve ser diferente do banco da aplicação.");
}
const db = new PrismaClient({ datasourceUrl: testUrl });
const prefix = `medicoes-${randomUUID()}`;
const emails = [`${prefix}-admin@example.test`, `${prefix}-employee@example.test`];
const password = `Senha-${randomUUID()}`;
let server, baseUrl, admin, employee, pond, active, closed, cancelled, adminCookie, employeeCookie;
let parameters = [];
let createdParameterIds = [];
let createdRangeIds = [];
let extraParameter;
const measured = new Date(Date.now() - 60_000).toISOString();

async function request(route, { method = "GET", cookie = adminCookie, body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${route}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  return { response, body: await response.json() };
}
function reading(code = "OD", changes = {}) {
  const parameter = parameters.find((item) => item.codigo === code);
  const values = { OD: 6, TEMPERATURA: 30, SALINIDADE: 25, PH: 8 };
  return { cicloId: active.id, parametroId: parameter.id, unidade: parameter.unidadePadrao, valor: values[code], medidoEm: measured, ...changes };
}
async function counts() {
  return [await db.medicao.count({ where: { cicloId: { in: [active.id, closed.id, cancelled.id] } } }), await db.alerta.count({ where: { medicao: { cicloId: { in: [active.id, closed.id, cancelled.id] } } } })];
}

before(async () => {
  execFileSync(process.execPath, [path.resolve(__dirname, "../node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, DATABASE_URL: testUrl }, stdio: "pipe", windowsHide: true });
  await db.$connect();
  admin = (await seedDemoAdmin(db, { nome: "Administrador de Teste", email: emails[0], senha: password })).usuario;
  employee = await db.usuario.create({ data: { nome: "Funcionário de Teste", email: emails[1], senha: await hashPassword(password), perfil: "FUNCIONARIO", criadoPor: admin.id } });
  const oldParameters = await db.parametro.findMany({ where: { codigo: { in: supportedCodes } }, select: { id: true } });
  const oldRanges = await db.faixaParametro.findMany({ where: { parametro: { codigo: { in: supportedCodes } } }, select: { id: true } });
  await seedDemoMedicoes(db, admin.id);
  parameters = await db.parametro.findMany({ where: { codigo: { in: supportedCodes } }, orderBy: { id: "asc" } });
  createdParameterIds = parameters.filter((p) => !oldParameters.some((old) => old.id === p.id)).map((p) => p.id);
  createdRangeIds = (await db.faixaParametro.findMany({ where: { parametroId: { in: parameters.map(p => p.id) } }, select: { id: true } })).filter((p) => !oldRanges.some((old) => old.id === p.id)).map((p) => p.id);
  pond = await db.viveiro.create({ data: { identificador: prefix, area: 1500, profundidadeMedia: 1.5, status: "OCUPADO" } });
  const cycleData = { viveiroId: pond.id, criadoPor: admin.id, dataInicio: new Date(Date.now() - 3 * 86400000), qtdLarvasInicial: 100000 };
  active = await db.cicloCultivo.create({ data: cycleData });
  closed = await db.cicloCultivo.create({ data: { ...cycleData, status: "FINALIZADO" } });
  cancelled = await db.cicloCultivo.create({ data: { ...cycleData, status: "CANCELADO" } });
  server = createApp(async () => { await db.$queryRaw`SELECT 1`; }, { db, session: { ttlMs: 3600000, secure: false } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function login(email) {
    const response = await fetch(`${baseUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha: password }) });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  }
  adminCookie = await login(admin.email);
  employeeCookie = await login(employee.email);
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (pond) {
      await db.alerta.deleteMany({ where: { medicao: { ciclo: { viveiroId: pond.id } } } });
      await db.medicao.deleteMany({ where: { ciclo: { viveiroId: pond.id } } });
      await db.faixaParametro.deleteMany({ where: { viveiroId: pond.id } });
      await db.cicloCultivo.deleteMany({ where: { viveiroId: pond.id } });
      await db.viveiro.delete({ where: { id: pond.id } });
    }
    await db.faixaParametro.deleteMany({ where: { id: { in: createdRangeIds } } });
    await db.parametro.deleteMany({ where: { id: { in: [...createdParameterIds, ...(extraParameter ? [extraParameter.id] : [])] } } });
    await db.usuario.deleteMany({ where: { email: { in: emails } } });
  } finally { await db.$disconnect(); }
});

test("registro, catálogo, histórico e alertas exigem autenticação", async () => {
  for (const [route, method] of [["/parametros", "GET"], ["/medicoes", "GET"], ["/medicoes", "POST"], ["/alertas", "GET"]]) {
    assert.equal((await request(route, { method, cookie: null, ...(method === "POST" ? { body: reading() } : {}) })).response.status, 401);
  }
});

test("catálogo identifica quatro parâmetros, unidades, limites e exemplos de faixa", async () => {
  const result = await request(`/parametros?cicloId=${active.id}`, { cookie: employeeCookie });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body.parametros.map(p => p.codigo).sort(), [...supportedCodes].sort());
  for (const p of result.body.parametros) {
    assert.ok(p.unidadePadrao);
    assert.equal(typeof p.minPossivel, "number");
    assert.equal(p.faixaIdeal.demonstrativa, true);
    assert.match(p.faixaIdeal.descricao, /exemplo/i);
  }
});

test("ambos os perfis registram valores ideais, com unidade, instante e responsável do servidor", async () => {
  for (const [index, code] of supportedCodes.entries()) {
    const result = await request("/medicoes", { method: "POST", cookie: index % 2 ? employeeCookie : adminCookie, body: reading(code) });
    assert.equal(result.response.status, 201);
    const medicao = result.body.medicao;
    assert.equal(medicao.parametro.codigo, code);
    assert.equal(medicao.unidade, reading(code).unidade);
    assert.equal(medicao.medidoEm, measured);
    assert.notEqual(medicao.criadoEm, measured);
    assert.equal(medicao.registradoPor.id, index % 2 ? employee.id : admin.id);
    assert.deepEqual(Object.keys(medicao.registradoPor).sort(), ["id", "nome"]);
    assert.equal(medicao.confirmadaForaFaixa, false);
    assert.deepEqual(medicao.alertas, []);
    assert.equal(medicao.faixaAplicada.demonstrativa, true);
  }
});

test("entradas inválidas não são persistidas mesmo com tentativa de confirmação", async () => {
  const before = await counts();
  for (const body of [
    reading("PH", { valor: 15, confirmarAnomalia: true }), reading("OD", { valor: -1, confirmarAnomalia: true }),
    reading("TEMPERATURA", { valor: 61, confirmarAnomalia: true }), reading("SALINIDADE", { valor: -1 }),
    reading("OD", { valor: "6" }), reading("OD", { valor: null }), reading("OD", { unidade: "°C" }),
    reading("OD", { medidoEm: "2026-02-30T12:00:00Z" }), reading("OD", { medidoEm: new Date(Date.now() + 86400000).toISOString() }),
    reading("OD", { medidoEm: new Date(active.dataInicio.getTime() - 60000).toISOString() }),
    reading("OD", { registradoPorId: employee.id }), reading("OD", { confirmarAnomalia: "true" }),
  ]) assert.equal((await request("/medicoes", { method: "POST", body })).response.status, 400);
  assert.deepEqual(await counts(), before);
});

test("anomalia sem confirmação retorna os limites e não grava medição nem alerta", async () => {
  const before = await counts();
  for (const confirmarAnomalia of [undefined, false]) {
    const result = await request("/medicoes", { method: "POST", cookie: employeeCookie, body: reading("OD", { valor: 4, ...(confirmarAnomalia === undefined ? {} : { confirmarAnomalia }) }) });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.detalhes.codigo, "CONFIRMACAO_ANOMALIA_NECESSARIA");
    assert.equal(result.body.detalhes.valor, 4);
    assert.equal(result.body.detalhes.faixaIdeal.minIdeal, 5);
    assert.equal(result.body.detalhes.faixaIdeal.maxIdeal, 7);
    assert.equal(result.body.detalhes.faixaIdeal.demonstrativa, true);
  }
  assert.deepEqual(await counts(), before);
});

test("anomalia confirmada persiste uma medição e um alerta pendente com o limite violado", async () => {
  const before = await counts();
  const result = await request("/medicoes", { method: "POST", cookie: employeeCookie, body: reading("OD", { valor: 4, confirmarAnomalia: true }) });
  assert.equal(result.response.status, 201);
  assert.deepEqual(await counts(), [before[0] + 1, before[1] + 1]);
  const medicao = result.body.medicao;
  assert.equal(medicao.confirmadaForaFaixa, true);
  assert.equal(medicao.registradoPor.id, employee.id);
  assert.equal(medicao.alertas.length, 1);
  assert.equal(medicao.alertas[0].valorMedido, 4);
  assert.equal(medicao.alertas[0].status, "PENDENTE");
  assert.match(medicao.alertas[0].limiteViolado, /mínimo ideal de 5 mg\/L/);
  assert.match(medicao.alertas[0].observacao, /demonstrativa/);
  const stored = await db.medicao.findUniqueOrThrow({ where: { id: medicao.id }, include: { alertas: true } });
  assert.equal(stored.alertas[0].medicaoId, stored.id);
});

test("confirmação não cria alerta para valores ideais e fronteiras ideais são inclusivas", async () => {
  for (const valor of [5, 7]) {
    const result = await request("/medicoes", { method: "POST", body: reading("OD", { valor, confirmarAnomalia: true }) });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.medicao.confirmadaForaFaixa, false);
    assert.deepEqual(result.body.medicao.alertas, []);
  }
});

test("ciclos encerrados ou cancelados rejeitam novas medições", async () => {
  const before = await counts();
  for (const cycle of [closed, cancelled]) {
    const result = await request("/medicoes", { method: "POST", body: reading("OD", { cicloId: cycle.id, confirmarAnomalia: true }) });
    assert.equal(result.response.status, 409);
  }
  assert.deepEqual(await counts(), before);
});

test("faixa específica prevalece sobre o exemplo global e fica preservada no registro", async () => {
  const ph = parameters.find(p => p.codigo === "PH");
  const local = await db.faixaParametro.create({ data: { parametroId: ph.id, viveiroId: pond.id, minIdeal: 8.1, maxIdeal: 8.3, criadoPor: admin.id, descricao: "Faixa do viveiro de teste" } });
  try {
    const first = await request("/medicoes", { method: "POST", body: reading("PH", { valor: 8 }) });
    assert.equal(first.response.status, 409);
    assert.equal(first.body.detalhes.faixaIdeal.id, local.id);
    const confirmed = await request("/medicoes", { method: "POST", body: reading("PH", { valor: 8, confirmarAnomalia: true }) });
    assert.equal(confirmed.response.status, 201);
    assert.equal(confirmed.body.medicao.faixaAplicada.demonstrativa, false);
    await db.faixaParametro.delete({ where: { id: local.id } });
    const stored = await db.medicao.findUniqueOrThrow({ where: { id: confirmed.body.medicao.id } });
    assert.equal(stored.faixaParametroId, null);
    assert.equal(stored.minIdealAplicado, 8.1);
    assert.equal(stored.maxIdealAplicado, 8.3);
  } finally { await db.faixaParametro.deleteMany({ where: { id: local.id } }); }
});

test("configuração ambígua não permite gravar medições", async () => {
  const ph = parameters.find(p => p.codigo === "PH");
  const before = await counts();
  const created = [];
  try {
    for (let i = 0; i < 2; i++) created.push((await db.faixaParametro.create({ data: { parametroId: ph.id, viveiroId: pond.id, minIdeal: 7.5, maxIdeal: 8.5, criadoPor: admin.id } })).id);
    const result = await request("/medicoes", { method: "POST", body: reading("PH", { confirmarAnomalia: true }) });
    assert.equal(result.response.status, 503);
    assert.deepEqual(await counts(), before);
  } finally { await db.faixaParametro.deleteMany({ where: { id: { in: created } } }); }
});

test("histórico e alertas incluem contexto, filtros e paginação, inclusive após encerramento", async () => {
  const result = await request(`/medicoes?cicloId=${active.id}&limite=2&offset=0`, { cookie: employeeCookie });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.medicoes.length, 2);
  assert.ok(result.body.total >= 7);
  for (const row of result.body.medicoes) assert.equal(row.ciclo.viveiro.id, pond.id);
  const alerts = await request(`/alertas?cicloId=${active.id}&status=PENDENTE`, { cookie: employeeCookie });
  assert.equal(alerts.response.status, 200);
  assert.ok(alerts.body.alertas.length >= 2);
  for (const row of alerts.body.alertas) {
    assert.equal(row.status, "PENDENTE");
    assert.equal(row.medicao.ciclo.id, active.id);
    assert.deepEqual(Object.keys(row.medicao.registradoPor).sort(), ["id", "nome"]);
  }
  await db.cicloCultivo.update({ where: { id: active.id }, data: { status: "FINALIZADO" } });
  try {
    const history = await request(`/medicoes?cicloId=${active.id}`, { cookie: employeeCookie });
    assert.equal(history.response.status, 200);
    assert.equal(history.body.total, result.body.total);
  } finally { await db.cicloCultivo.update({ where: { id: active.id }, data: { status: "ATIVO" } }); }
});

test("seed repetido preserva parâmetros e faixas e não pode ser preparado por funcionário", async () => {
  const before = await db.parametro.findMany({ where: { id: { in: parameters.map(p => p.id) } }, include: { faixas: true }, orderBy: { id: "asc" } });
  assert.deepEqual(await seedDemoMedicoes(db, admin.id), { parametersCreated: 0, rangesCreated: 0 });
  const preserved = await db.parametro.findMany({ where: { id: { in: parameters.map(p => p.id) } }, include: { faixas: true }, orderBy: { id: "asc" } });
  assert.deepEqual(preserved, before);
  await assert.rejects(seedDemoMedicoes(db, employee.id), (error) => error.status === 403);
});

test("falhas de persistência não deixam medição nem alerta parcial", async () => {
  const before = await counts();
  await assert.rejects(recordMedicao(db, validateNewMedicao(reading("OD", { valor: 4, confirmarAnomalia: true })), 2147483647));
  assert.deepEqual(await counts(), before);
});

test("filtros inválidos e parâmetros não suportados são recusados", async () => {
  for (const route of ["/medicoes?limite=101", "/medicoes?cicloId=abc", "/alertas?status=INVALIDO", "/parametros?cicloId=0"]) assert.equal((await request(route)).response.status, 400);
  assert.equal((await request("/parametros?cicloId=2147483647")).response.status, 404);
  extraParameter = await db.parametro.create({ data: { codigo: prefix, nome: "Não suportado", unidadePadrao: "mg/L", minPossivel: 0, maxPossivel: 10 } });
  assert.equal((await request("/medicoes", { method: "POST", body: reading("OD", { parametroId: extraParameter.id }) })).response.status, 400);
});
