const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../dist/app");
const { hashPassword } = require("../dist/auth/password");
const { seedDemoMedicoes } = require("../dist/demo/seed-medicoes");
require("dotenv/config");
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test"))
  throw new Error("Use um banco separado terminado em _test.");
if (process.env.DATABASE_URL) {
  const main = new URL(process.env.DATABASE_URL),
    target = new URL(testUrl);
  if (main.host === target.host && main.pathname === target.pathname)
    throw new Error("Não use o banco da aplicação nos testes.");
}
const db = new PrismaClient({ datasourceUrl: testUrl });
const prefix = `cultivo-${randomUUID()}`;
const password = `Teste-${randomUUID()}`;
let server, base, admin, employee, adminCookie, employeeCookie, parameter;
const recoveryMessages = [];
const ids = [];
const paramIds = [],
  rangeIds = [];
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const occurred = new Date(Date.now() - 3600000).toISOString();
const closingTime = new Date(Date.now() - 1000).toISOString();
async function request(
  route,
  { method = "GET", cookie = adminCookie, body } = {},
) {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: response.status === 204 ? null : await response.json(),
  };
}
async function pond() {
  const row = await request("/viveiros", {
    method: "POST",
    body: {
      identificador: `${prefix}-${ids.length}`,
      area: 10000,
      profundidadeMedia: 1.5,
    },
  });
  assert.equal(row.status, 201);
  ids.push(row.body.viveiro.id);
  const opened = await request(`/viveiros/${row.body.viveiro.id}/ciclos`, {
    method: "POST",
    body: { dataInicio: yesterday, qtdLarvasInicial: 100000 },
  });
  assert.equal(opened.status, 201);
  return { ...row.body.viveiro, cycle: opened.body.ciclo };
}
const expense = (p, changes = {}) => ({
  viveiroId: p.id,
  cicloId: p.cycle.id,
  data: occurred,
  fornecedorNome: "Fornecedor teste",
  itens: [
    {
      categoria: "RACAO",
      descricao: "Ração",
      quantidade: 3,
      unidade: "kg",
      valorUnit: 10.15,
    },
  ],
  ...changes,
});
const closing = (changes) => ({
  motivo: "VENDA",
  dataEncerramento: closingTime,
  compradorNome: "Comprador teste",
  pesoTotalKg: 2000,
  precoPorKg: 25.15,
  quantidadeFinal: 80000,
  ...changes,
});
before(async () => {
  execFileSync(
    process.execPath,
    [
      path.resolve(__dirname, "../node_modules/prisma/build/index.js"),
      "migrate",
      "deploy",
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: "pipe",
      windowsHide: true,
    },
  );
  const hash = await hashPassword(password);
  admin = await db.usuario.create({
    data: {
      nome: "Admin teste",
      email: `${prefix}-admin@example.test`,
      senha: hash,
      perfil: "ADMINISTRADOR",
    },
  });
  employee = await db.usuario.create({
    data: {
      nome: "Funcionário teste",
      email: `${prefix}-employee@example.test`,
      senha: hash,
      perfil: "FUNCIONARIO",
      criadoPor: admin.id,
    },
  });
  const oldParams = await db.parametro.findMany({ select: { id: true } });
  const oldRanges = await db.faixaParametro.findMany({ select: { id: true } });
  await seedDemoMedicoes(db, admin.id);
  for (const p of await db.parametro.findMany({ select: { id: true } }))
    if (!oldParams.some((old) => old.id === p.id)) paramIds.push(p.id);
  for (const r of await db.faixaParametro.findMany({ select: { id: true } }))
    if (!oldRanges.some((old) => old.id === r.id)) rangeIds.push(r.id);
  parameter = await db.parametro.findUnique({ where: { codigo: "OD" } });
  server = createApp(
    async () => {
      await db.$queryRaw`SELECT 1`;
    },
    {
      db,
      session: { ttlMs: 3600000, secure: false },
      recovery: {
        appUrl: "http://127.0.0.1:5173",
        send: async (message) => {
          recoveryMessages.push(message);
        },
      },
    },
  ).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  for (const user of [admin, employee]) {
    const result = await request("/auth/login", {
      method: "POST",
      body: { email: user.email, senha: password },
      cookie: null,
    });
    assert.equal(result.status, 200);
    const cookie = result.headers.get("set-cookie").split(";")[0];
    if (user === admin) adminCookie = cookie;
    else employeeCookie = cookie;
  }
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    await db.alerta.deleteMany({
      where: { medicao: { ciclo: { viveiroId: { in: ids } } } },
    });
    await db.medicao.deleteMany({
      where: { ciclo: { viveiroId: { in: ids } } },
    });
    await db.compraDespesa.deleteMany({ where: { criadoPor: admin?.id } });
    await db.venda.deleteMany({ where: { viveiroId: { in: ids } } });
    await db.eventoOperacional.deleteMany({
      where: { viveiroId: { in: ids } },
    });
    await db.cicloCultivo.deleteMany({ where: { viveiroId: { in: ids } } });
    await db.viveiro.deleteMany({ where: { id: { in: ids } } });
    await db.faixaParametro.deleteMany({ where: { id: { in: rangeIds } } });
    await db.parametro.deleteMany({ where: { id: { in: paramIds } } });
    await db.usuario.deleteMany({ where: { email: { startsWith: prefix } } });
  } finally {
    await db.$disconnect();
  }
});
test("novas rotas exigem sessão e financeiro exige administrador", async () => {
  for (const route of [
    "/eventos",
    "/despesas",
    "/vendas",
    "/indicadores/resumo",
  ])
    assert.equal((await request(route, { cookie: null })).status, 401);
  for (const route of ["/despesas", "/vendas"])
    assert.equal(
      (await request(route, { cookie: employeeCookie })).status,
      403,
    );
  const summary = await request("/indicadores/resumo", {
    cookie: employeeCookie,
  });
  assert.equal(summary.status, 200);
  assert.equal("financeiro" in summary.body, false);
});
test("ocorrência preserva autoria e vínculo e funcionário apenas consulta", async () => {
  const p = await pond();
  const body = {
    viveiroId: p.id,
    cicloId: p.cycle.id,
    dataHora: occurred,
    tipo: "MANUTENCAO",
    descricao: "Revisão da bomba",
  };
  assert.equal(
    (
      await request("/eventos", {
        method: "POST",
        cookie: employeeCookie,
        body,
      })
    ).status,
    403,
  );
  const result = await request("/eventos", { method: "POST", body });
  assert.equal(result.status, 201);
  assert.equal(result.body.evento.criadoPor, admin.id);
  const history = await request(`/eventos?cicloId=${p.cycle.id}`, {
    cookie: employeeCookie,
  });
  assert.equal(history.body.total, 1);
  assert.equal(history.body.eventos[0].responsavel.id, admin.id);
  for (const invalid of [
    { ...body, criadoPor: employee.id },
    { ...body, dataHora: "2026-02-31T12:00:00Z" },
    { ...body, descricao: "" },
    { ...body, tipo: "ENCERRAMENTO_VENDA" },
  ])
    assert.equal(
      (await request("/eventos", { method: "POST", body: invalid })).status,
      400,
    );
  const other = await pond();
  assert.equal(
    (
      await request("/eventos", {
        method: "POST",
        body: { ...body, viveiroId: other.id },
      })
    ).status,
    400,
  );
});
test("despesa calcula centavos no servidor e rejeita total ou vínculo adulterado", async () => {
  const p = await pond();
  const body = expense(p);
  const result = await request("/despesas", { method: "POST", body });
  assert.equal(result.status, 201);
  assert.equal(result.body.despesa.valorTotal, 30.45);
  assert.equal(
    (await request(`/despesas?cicloId=${p.cycle.id}`)).body.valorTotal,
    30.45,
  );
  assert.equal(
    (
      await request("/despesas", {
        method: "POST",
        body: { ...body, valorTotal: 1 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/despesas", {
        method: "POST",
        body: { ...body, itens: [{ ...body.itens[0], valorUnit: -1 }] },
      })
    ).status,
    400,
  );
  const other = await pond();
  assert.equal(
    (
      await request("/despesas", {
        method: "POST",
        body: { ...body, viveiroId: other.id },
      })
    ).status,
    400,
  );
});
test("encerramento grava uma venda, preserva registros e libera novo povoamento", async () => {
  const p = await pond();
  await request("/despesas", { method: "POST", body: expense(p) });
  await request("/medicoes", {
    method: "POST",
    cookie: employeeCookie,
    body: {
      cicloId: p.cycle.id,
      parametroId: parameter.id,
      unidade: "mg/L",
      valor: 6,
      medidoEm: occurred,
    },
  });
  const route = `/viveiros/${p.id}/ciclos/${p.cycle.id}/encerramento`;
  assert.equal(
    (
      await request(route, {
        method: "POST",
        cookie: employeeCookie,
        body: closing(),
      })
    ).status,
    403,
  );
  const result = await request(route, { method: "POST", body: closing() });
  assert.equal(result.status, 200);
  assert.equal(result.body.venda.valorTotal, 50300);
  assert.equal(result.body.ciclo.status, "FINALIZADO");
  const detail = (await request(`/viveiros/${p.id}`)).body.viveiro;
  assert.equal(detail.status, "DISPONIVEL");
  assert.equal(detail.cicloAtivo, null);
  assert.equal(detail.ciclos[0].motivoEncerramento, "VENDA");
  assert.equal(
    (await request(route, { method: "POST", body: closing() })).status,
    409,
  );
  assert.equal(
    (
      await request("/medicoes", {
        method: "POST",
        body: {
          cicloId: p.cycle.id,
          parametroId: parameter.id,
          unidade: "mg/L",
          valor: 6,
          medidoEm: occurred,
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(`/medicoes?cicloId=${p.cycle.id}`)).body.total,
    1,
  );
  const summary = (await request(`/indicadores/resumo?cicloId=${p.cycle.id}`))
    .body;
  assert.deepEqual(summary.financeiro, {
    despesas: 30.45,
    receitas: 50300,
    saldoRegistrado: 50269.55,
    pesoVendidoKg: 2000,
  });
  assert.equal(
    (
      await request(`/viveiros/${p.id}/ciclos`, {
        method: "POST",
        body: {
          dataInicio: new Date().toISOString().slice(0, 10),
          qtdLarvasInicial: 10000,
        },
      })
    ).status,
    201,
  );
});
test("perda total exige motivo, não cria venda e encerra uma única vez sob concorrência", async () => {
  const p = await pond(),
    route = `/viveiros/${p.id}/ciclos/${p.cycle.id}/encerramento`;
  const body = {
    motivo: "PERDA_TOTAL",
    dataEncerramento: closingTime,
    justificativa: "Mortalidade total identificada",
  };
  assert.equal(
    (
      await request(route, {
        method: "POST",
        body: { ...body, justificativa: "" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(route, {
        method: "POST",
        body: { ...body, pesoTotalKg: 10 },
      })
    ).status,
    400,
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () => request(route, { method: "POST", body })),
  );
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  assert.equal(results.filter((result) => result.status === 409).length, 4);
  assert.equal(await db.venda.count({ where: { cicloId: p.cycle.id } }), 0);
  assert.equal(
    await db.eventoOperacional.count({ where: { cicloId: p.cycle.id } }),
    1,
  );
  assert.equal(
    (await request(`/indicadores/resumo?cicloId=${p.cycle.id}`)).body.financeiro
      .receitas,
    0,
  );
});
test("datas incoerentes e dados finais inválidos não alteram ciclo ou viveiro", async () => {
  const p = await pond(),
    route = `/viveiros/${p.id}/ciclos/${p.cycle.id}/encerramento`;
  for (const changes of [
    { pesoTotalKg: -1 },
    { quantidadeFinal: 200000 },
    { dataEncerramento: "2000-01-01" },
    { dataEncerramento: new Date(Date.now() + 86400000).toISOString() },
  ])
    assert.equal(
      (await request(route, { method: "POST", body: closing(changes) })).status,
      400,
    );
  assert.equal(
    (await db.cicloCultivo.findUnique({ where: { id: p.cycle.id } })).status,
    "ATIVO",
  );
  assert.equal(
    (await db.viveiro.findUnique({ where: { id: p.id } })).status,
    "OCUPADO",
  );
  assert.equal(await db.venda.count({ where: { cicloId: p.cycle.id } }), 0);
});
test("indicadores respeitam filtros, período e parâmetros e devolvem ausência de dados", async () => {
  const p = await pond();
  await request("/despesas", { method: "POST", body: expense(p) });
  assert.equal(
    (
      await request(
        `/indicadores/resumo?cicloId=${p.cycle.id}&inicio=2000-01-01&fim=2000-01-02`,
      )
    ).body.financeiro.despesas,
    0,
  );
  const evolution = await request(
    `/indicadores/evolucao?cicloId=${p.cycle.id}&parametroId=${parameter.id}`,
  );
  assert.equal(evolution.status, 200);
  assert.equal(evolution.body.medicoes.length, 0);
  assert.equal(evolution.body.truncado, false);
  assert.equal(
    (await request("/indicadores/resumo?inicio=2026-11-30&fim=2026-11-01"))
      .status,
    400,
  );
  assert.equal(
    (await request("/indicadores/evolucao?parametroId=abc")).status,
    400,
  );
});

test("gestão de funcionários preserva privilégios e inativa todas as sessões", async () => {
  assert.equal(
    (
      await request(`/usuarios/${employee.id}`, {
        method: "PATCH",
        cookie: employeeCookie,
        body: { nome: "Outro nome" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/usuarios/${employee.id}`, {
        method: "PATCH",
        body: { perfil: "ADMINISTRADOR" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/usuarios/${employee.id}`, {
        method: "PATCH",
        body: { email: admin.email.toUpperCase() },
      })
    ).status,
    409,
  );
  const edited = await request(`/usuarios/${employee.id}`, {
    method: "PATCH",
    body: { nome: "Funcionário editado", telefone: "85999999999" },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.usuario.nome, "Funcionário editado");
  assert.equal("senha" in edited.body.usuario, false);
  assert.equal(
    (
      await request(`/usuarios/${employee.id}`, {
        method: "PATCH",
        body: { status: "INATIVO" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/auth/me", { cookie: employeeCookie })).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        cookie: null,
        body: { email: employee.email, senha: password },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(`/usuarios/${employee.id}`, {
        method: "PATCH",
        body: { status: "ATIVO" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/auth/me", { cookie: employeeCookie })).status,
    401,
  );
  const login = await request("/auth/login", {
    method: "POST",
    cookie: null,
    body: { email: employee.email, senha: password },
  });
  assert.equal(login.status, 200);
  employeeCookie = login.headers.get("set-cookie").split(";")[0];
});
test("administrador redefine credenciais sem expor hash e encerra sessões anteriores", async () => {
  const novaSenha = `Nova-${randomUUID()}`;
  assert.equal(
    (
      await request(`/usuarios/${employee.id}/senha`, {
        method: "POST",
        cookie: employeeCookie,
        body: { senha: novaSenha },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/usuarios/${employee.id}/senha`, {
        method: "POST",
        body: { senha: "123" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/usuarios/${employee.id}/senha`, {
        method: "POST",
        body: { senha: novaSenha },
      })
    ).status,
    204,
  );
  assert.equal(
    (await request("/auth/me", { cookie: employeeCookie })).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        cookie: null,
        body: { email: employee.email, senha: password },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        cookie: null,
        body: { email: employee.email, senha: novaSenha },
      })
    ).status,
    200,
  );
  await request(`/usuarios/${employee.id}/senha`, {
    method: "POST",
    body: { senha: password },
  });
  const login = await request("/auth/login", {
    method: "POST",
    cookie: null,
    body: { email: employee.email, senha: password },
  });
  employeeCookie = login.headers.get("set-cookie").split(";")[0];
});

test("recuperação não enumera contas, guarda apenas hash e o link só funciona uma vez", async () => {
  const known = await request("/auth/recuperar-senha", {
    method: "POST",
    cookie: null,
    body: { email: employee.email },
  });
  const unknown = await request("/auth/recuperar-senha", {
    method: "POST",
    cookie: null,
    body: { email: `${prefix}-missing@example.test` },
  });
  assert.equal(known.status, 202);
  assert.equal(unknown.status, 202);
  assert.deepEqual(known.body, unknown.body);
  assert.equal("token" in known.body, false);
  for (let i = 0; i < 20 && !recoveryMessages.length; i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(recoveryMessages.length, 1);
  const token = new URLSearchParams(
    new URL(recoveryMessages[0].url).hash.slice(1),
  ).get("token");
  const stored = await db.recuperacaoSenha.findFirst({
    where: { usuarioId: employee.id },
  });
  assert.notEqual(stored.tokenHash, token);
  assert.equal(stored.tokenHash.length, 64);
  const senha = `Recuperada-${randomUUID()}`;
  const results = await Promise.all(
    [1, 2].map(() =>
      request("/auth/redefinir-senha", {
        method: "POST",
        cookie: null,
        body: { token, senha },
      }),
    ),
  );
  assert.equal(results.filter((row) => row.status === 204).length, 1);
  assert.equal(results.filter((row) => row.status === 400).length, 1);
  assert.equal(
    (await request("/auth/me", { cookie: employeeCookie })).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        cookie: null,
        body: { email: employee.email, senha },
      })
    ).status,
    200,
  );
  await request(`/usuarios/${employee.id}/senha`, {
    method: "POST",
    body: { senha: password },
  });
  const refreshed = await request("/auth/login", {
    method: "POST",
    cookie: null,
    body: { email: employee.email, senha: password },
  });
  employeeCookie = refreshed.headers.get("set-cookie").split(";")[0];
});
test("links expirados e tokens inválidos não redefinem a senha", async () => {
  await request("/auth/recuperar-senha", {
    method: "POST",
    cookie: null,
    body: { email: employee.email },
  });
  for (let i = 0; i < 20 && recoveryMessages.length < 2; i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  const token = new URLSearchParams(
    new URL(recoveryMessages[1].url).hash.slice(1),
  ).get("token");
  await db.recuperacaoSenha.updateMany({
    where: { usuarioId: employee.id },
    data: { expiraEm: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (
      await request("/auth/redefinir-senha", {
        method: "POST",
        cookie: null,
        body: { token, senha: password },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/auth/redefinir-senha", {
        method: "POST",
        cookie: null,
        body: { token: "invalido", senha: password },
      })
    ).status,
    400,
  );
});

test("manutenção de viveiros mantém histórico e bloqueia inativação durante o ciclo", async () => {
  const p = await pond();
  assert.equal(
    (
      await request(`/viveiros/${p.id}`, {
        method: "PATCH",
        cookie: employeeCookie,
        body: { area: 5000 },
      })
    ).status,
    403,
  );
  const edited = await request(`/viveiros/${p.id}`, {
    method: "PATCH",
    body: { area: 9000, localizacao: "Setor atualizado" },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.viveiro.area, 9000);
  assert.equal(
    (
      await request(`/viveiros/${p.id}`, {
        method: "PATCH",
        body: { status: "INATIVO" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/viveiros/${p.id}`, {
        method: "PATCH",
        body: { status: "OCUPADO" },
      })
    ).status,
    400,
  );
  const other = await pond();
  assert.equal(
    (
      await request(`/viveiros/${p.id}`, {
        method: "PATCH",
        body: { identificador: other.identificador.toUpperCase() },
      })
    ).status,
    409,
  );
  await request(`/viveiros/${p.id}/ciclos/${p.cycle.id}/encerramento`, {
    method: "POST",
    body: {
      motivo: "PERDA_TOTAL",
      dataEncerramento: closingTime,
      justificativa: "Teste de manutenção",
    },
  });
  assert.equal(
    (
      await request(`/viveiros/${p.id}`, {
        method: "PATCH",
        body: { status: "INATIVO" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/viveiros/${p.id}`)).body.viveiro.totalCiclos,
    1,
  );
  assert.equal(
    (
      await request(`/viveiros/${p.id}/ciclos`, {
        method: "POST",
        body: { dataInicio: yesterday, qtdLarvasInicial: 1000 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/viveiros/${p.id}`, {
        method: "PATCH",
        body: { status: "DISPONIVEL" },
      })
    ).status,
    200,
  );
});

test("tratamento de alerta exige administrador e justificativa e preserva o registro original", async () => {
  const p = await pond();
  const row = await request("/medicoes", {
    method: "POST",
    body: {
      cicloId: p.cycle.id,
      parametroId: parameter.id,
      unidade: "mg/L",
      valor: 4,
      medidoEm: occurred,
      confirmarAnomalia: true,
    },
  });
  const alert = row.body.medicao.alertas[0];
  assert.equal(
    (
      await request(`/alertas/${alert.id}`, {
        method: "PATCH",
        cookie: employeeCookie,
        body: { status: "RESOLVIDO", observacao: "Aerador ajustado" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/alertas/${alert.id}`, {
        method: "PATCH",
        body: { status: "RESOLVIDO", observacao: "" },
      })
    ).status,
    400,
  );
  const results = await Promise.all(
    ["RESOLVIDO", "IGNORADO"].map((status) =>
      request(`/alertas/${alert.id}`, {
        method: "PATCH",
        body: { status, observacao: "Aerador ajustado e leitura conferida" },
      }),
    ),
  );
  assert.equal(results.filter((row) => row.status === 200).length, 1);
  assert.equal(results.filter((row) => row.status === 409).length, 1);
  const stored = await db.alerta.findUnique({ where: { id: alert.id } });
  assert.equal(stored.resolvidoPorId, admin.id);
  assert.equal(stored.valorMedido, 4);
  assert.equal(stored.limiteViolado, alert.limiteViolado);
  assert.equal(stored.observacao, alert.observacao);
  assert.ok(stored.resolvidoEm);
  assert.equal(
    (await request(`/indicadores/resumo?cicloId=${p.cycle.id}`)).body
      .alertasPendentes,
    0,
  );
});
