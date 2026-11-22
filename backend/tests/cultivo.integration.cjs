const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { randomUUID, createHmac } = require("node:crypto");
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
let originalWhatsAppConfig,
  scopedDb,
  providerCalls = 0;
let providerMode = "ok";
const whatsappOptions = {
  accessToken: "token-de-teste-local",
  phoneNumberId: "123456789",
  version: "v27.0",
  appSecret: "segredo-de-assinatura-do-teste",
  verifyToken: "verificacao-local",
  fetcher: async (_url, options) => {
    providerCalls++;
    const body = JSON.parse(options.body);
    assert.equal(body.type, "template");
    assert.equal(body.messaging_product, "whatsapp");
    assert.equal(
      body.template.components[0].parameters[0].text.length <= 1000,
      true,
    );
    if (providerMode === "timeout") throw new Error("Timeout simulado");
    if (providerMode === "bad-request")
      return new Response("{}", { status: 400 });
    return new Response(
      JSON.stringify({
        messages: [{ id: `wamid.teste-${body.biz_opaque_callback_data}` }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
};
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
  originalWhatsAppConfig = await db.configResumoWhatsApp.findUnique({
    where: { id: 1 },
  });
  scopedDb = db.$extends({
    query: {
      contatoWhatsApp: {
        findMany({ args, query }) {
          args.where = { AND: [args.where ?? {}, { criadoPor: admin.id }] };
          return query(args);
        },
      },
      envioWhatsApp: {
        findMany({ args, query }) {
          args.where = {
            AND: [args.where ?? {}, { contato: { criadoPor: admin.id } }],
          };
          return query(args);
        },
        count({ args, query }) {
          args.where = {
            AND: [args.where ?? {}, { contato: { criadoPor: admin.id } }],
          };
          return query(args);
        },
        updateMany({ args, query }) {
          args.where = {
            AND: [args.where ?? {}, { contato: { criadoPor: admin.id } }],
          };
          return query(args);
        },
      },
    },
  });
  server = createApp(
    async () => {
      await db.$queryRaw`SELECT 1`;
    },
    {
      db: scopedDb,
      session: { ttlMs: 3600000, secure: false },
      recovery: {
        appUrl: "http://127.0.0.1:5173",
        send: async (message) => {
          recoveryMessages.push(message);
        },
      },
      whatsapp: whatsappOptions,
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
    await db.envioWhatsApp.deleteMany({
      where: { contato: { criadoPor: admin?.id } },
    });
    await db.contatoWhatsApp.deleteMany({ where: { criadoPor: admin?.id } });
    if (originalWhatsAppConfig)
      await db.configResumoWhatsApp.upsert({
        where: { id: 1 },
        create: originalWhatsAppConfig,
        update: originalWhatsAppConfig,
      });
    else await db.configResumoWhatsApp.deleteMany({ where: { id: 1 } });
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
    await db.faixaParametro.deleteMany({ where: { viveiroId: { in: ids } } });
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

test("rotina respeita fuso, janela, ciclo ativo e impede horários sobrepostos", async () => {
  const { pendingReadings } = require("../dist/rotinas/service");
  const p = await pond();
  const body = {
    parametroId: parameter.id,
    viveiroId: p.id,
    horario: "06:00",
    fuso: "America/Sao_Paulo",
    toleranciaMinutos: 30,
  };
  assert.equal(
    (
      await request("/rotinas", {
        method: "POST",
        cookie: employeeCookie,
        body,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/rotinas", {
        method: "POST",
        body: { ...body, fuso: "invalido" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/rotinas", {
        method: "POST",
        body: { ...body, horario: "25:00" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/rotinas", { method: "POST", body })).status,
    201,
  );
  assert.equal(
    (
      await request("/rotinas", {
        method: "POST",
        body: { ...body, horario: "06:15" },
      })
    ).status,
    409,
  );
  const simultaneous = await Promise.all(
    [1, 2].map(() =>
      request("/rotinas", {
        method: "POST",
        body: { ...body, horario: "18:00" },
      }),
    ),
  );
  assert.equal(simultaneous.filter((row) => row.status === 201).length, 1);
  assert.equal(simultaneous.filter((row) => row.status === 409).length, 1);
  const now = new Date(`${yesterday}T23:00:00Z`);
  const before = await pendingReadings(
    db,
    { cicloId: String(p.cycle.id), data: yesterday },
    now,
  );
  assert.equal(before.total, 2);
  assert.equal(
    (
      await request("/medicoes", {
        method: "POST",
        body: {
          cicloId: p.cycle.id,
          parametroId: parameter.id,
          valor: 6,
          unidade: "mg/L",
          medidoEm: `${yesterday}T09:00:00Z`,
        },
      })
    ).status,
    201,
  );
  const after = await pendingReadings(
    db,
    { cicloId: String(p.cycle.id), data: yesterday },
    now,
  );
  assert.equal(after.total, 1);
  assert.equal(
    after.pendencias.filter((row) => row.situacao === "CONCLUIDA").length,
    1,
  );
  const future = await pendingReadings(
    db,
    { cicloId: String(p.cycle.id), data: yesterday },
    new Date(`${yesterday}T05:00:00Z`),
  );
  assert.equal(
    future.pendencias.every((row) => row.situacao === "AGUARDANDO"),
    true,
  );
  await request(`/viveiros/${p.id}/ciclos/${p.cycle.id}/encerramento`, {
    method: "POST",
    body: {
      motivo: "PERDA_TOTAL",
      dataEncerramento: closingTime,
      justificativa: "Fim do teste de rotina",
    },
  });
  assert.equal(
    (
      await pendingReadings(
        db,
        { cicloId: String(p.cycle.id), data: yesterday },
        now,
      )
    ).pendencias.length,
    0,
  );
});

test("faixas por fase rejeitam sobreposição e preservam limites históricos após edição", async () => {
  const p = await pond();
  const body = {
    parametroId: parameter.id,
    viveiroId: p.id,
    minIdeal: 6,
    maxIdeal: 8,
    faseNome: "Fase inicial",
    diaInicial: 0,
    diaFinal: 10,
    demonstrativa: true,
  };
  assert.equal(
    (await request("/faixas", { method: "POST", cookie: employeeCookie, body }))
      .status,
    403,
  );
  assert.equal(
    (
      await request("/faixas", {
        method: "POST",
        body: { ...body, minIdeal: 35 },
      })
    ).status,
    400,
  );
  const first = await request("/faixas", { method: "POST", body });
  assert.equal(first.status, 201);
  assert.equal(
    (
      await request("/faixas", {
        method: "POST",
        body: { ...body, diaInicial: 10, diaFinal: 20 },
      })
    ).status,
    409,
  );
  const future = {
    ...body,
    faseNome: "Fase seguinte",
    diaInicial: 11,
    diaFinal: 30,
  };
  const simultaneous = await Promise.all(
    [1, 2].map(() => request("/faixas", { method: "POST", body: future })),
  );
  assert.equal(simultaneous.filter((row) => row.status === 201).length, 1);
  assert.equal(simultaneous.filter((row) => row.status === 409).length, 1);
  const catalog = await request(
    `/parametros?cicloId=${p.cycle.id}&medidoEm=${encodeURIComponent(occurred)}`,
  );
  const current = catalog.body.parametros.find(
    (row) => row.id === parameter.id,
  );
  assert.equal(current.faixaIdeal.faseNome, "Fase inicial");
  const reading = {
    cicloId: p.cycle.id,
    parametroId: parameter.id,
    valor: 5.5,
    unidade: "mg/L",
    medidoEm: occurred,
  };
  assert.equal(
    (await request("/medicoes", { method: "POST", body: reading })).status,
    409,
  );
  const saved = await request("/medicoes", {
    method: "POST",
    body: { ...reading, confirmarAnomalia: true },
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.medicao.faixaAplicada.minIdeal, 6);
  const edited = await request(`/faixas/${first.body.faixa.id}`, {
    method: "PUT",
    body: { ...body, minIdeal: 7, maxIdeal: 9 },
  });
  assert.equal(edited.status, 200);
  assert.notEqual(edited.body.faixa.id, first.body.faixa.id);
  assert.equal(
    (await db.faixaParametro.findUnique({ where: { id: first.body.faixa.id } }))
      .ativo,
    false,
  );
  const history = (await request(`/medicoes?cicloId=${p.cycle.id}`)).body
    .medicoes[0];
  assert.equal(history.faixaAplicada.id, first.body.faixa.id);
  assert.equal(history.faixaAplicada.minIdeal, 6);
  assert.equal(history.faixaAplicada.maxIdeal, 8);
  assert.equal(
    (
      await request("/medicoes", {
        method: "POST",
        body: { ...reading, valor: 6.5 },
      })
    ).status,
    409,
  );
});

test("compra com vários itens calcula centavos e edição mantém auditoria e controle de versão", async () => {
  const p = await pond();
  const body = expense(p, {
    itens: [
      {
        categoria: "RACAO",
        descricao: "Ração",
        quantidade: 1.5,
        unidade: "kg",
        valorUnit: 10.15,
      },
      {
        categoria: "ENERGIA",
        descricao: "Energia",
        quantidade: 3,
        unidade: "kWh",
        valorUnit: 0.1,
      },
    ],
  });
  const created = await request("/despesas", { method: "POST", body });
  assert.equal(created.status, 201);
  assert.equal(created.body.despesa.valorTotal, 15.53);
  assert.equal(created.body.despesa.versao, 1);
  const route = `/despesas/${created.body.despesa.id}`;
  const edit = {
    ...body,
    versao: 1,
    statusPagamento: "PAGO",
    itens: [{ ...body.itens[0], quantidade: 2 }],
  };
  assert.equal(
    (
      await request(route, {
        method: "PUT",
        cookie: employeeCookie,
        body: edit,
      })
    ).status,
    403,
  );
  const results = await Promise.all(
    [1, 2].map(() => request(route, { method: "PUT", body: edit })),
  );
  assert.equal(results.filter((row) => row.status === 200).length, 1);
  assert.equal(results.filter((row) => row.status === 409).length, 1);
  const detail = (await request(route)).body.despesa;
  assert.equal(detail.valorTotal, 20.3);
  assert.equal(detail.versao, 2);
  assert.equal(detail.historico.length, 1);
  assert.equal(detail.historico[0].dadosAnteriores.valorTotal, 15.53);
  assert.equal(detail.historico[0].dadosAnteriores.itens.length, 2);
  assert.equal(
    (
      await request("/despesas", {
        method: "POST",
        body: { ...body, itens: [] },
      })
    ).status,
    400,
  );
});

test("relatório calcula indicadores de produção com área histórica e distingue dados ausentes", async () => {
  const p = await pond();
  await request("/despesas", { method: "POST", body: expense(p) });
  await request(`/viveiros/${p.id}`, { method: "PATCH", body: { area: 5000 } });
  await request(`/viveiros/${p.id}/ciclos/${p.cycle.id}/encerramento`, {
    method: "POST",
    body: closing(),
  });
  assert.equal(
    (await request("/relatorios", { cookie: employeeCookie })).status,
    403,
  );
  const report = await request(`/relatorios?cicloId=${p.cycle.id}`);
  assert.equal(report.status, 200);
  const row = report.body.ciclos[0];
  assert.equal(row.areaPovoamentoM2, 10000);
  assert.equal(row.produtividadeKgHa, 2000);
  assert.equal(row.sobrevivenciaPercentual, 80);
  assert.equal(row.pesoMedioFinalG, 25);
  assert.equal(row.custoRegistradoPorKg, 0.0152);
  assert.equal(row.saldoRegistrado, 50269.55);
  assert.equal(report.body.custosPorCategoria[0].valor, 30.45);
  assert.equal(
    report.body.financeiroPorDia.reduce((sum, item) => sum + item.receitas, 0),
    50300,
  );
  const other = await pond();
  const incomplete = (await request(`/relatorios?cicloId=${other.cycle.id}`))
    .body.ciclos[0];
  assert.equal(incomplete.sobrevivenciaPercentual, null);
  assert.equal(incomplete.produtividadeKgHa, null);
  assert.ok(incomplete.dadosFaltantes.length);
});
test("amônia pode ser configurada explicitamente e segue as mesmas regras de medição", async () => {
  if (await db.parametro.findUnique({ where: { codigo: "NH3" } })) return;
  const body = {
    codigo: "NH3",
    minPossivel: 0,
    maxPossivel: 10,
    minIdeal: 0,
    maxIdeal: 0.1,
    demonstrativa: true,
  };
  assert.equal(
    (
      await request("/faixas/parametros", {
        method: "POST",
        cookie: employeeCookie,
        body,
      })
    ).status,
    403,
  );
  const created = await request("/faixas/parametros", { method: "POST", body });
  assert.equal(created.status, 201);
  paramIds.push(created.body.parametro.id);
  const ranges = await db.faixaParametro.findMany({
    where: { parametroId: created.body.parametro.id },
    select: { id: true },
  });
  rangeIds.push(...ranges.map((row) => row.id));
  assert.equal(
    (await request("/faixas/parametros", { method: "POST", body })).status,
    409,
  );
  const p = await pond();
  assert.equal(
    (
      await request("/medicoes", {
        method: "POST",
        body: {
          cicloId: p.cycle.id,
          parametroId: created.body.parametro.id,
          valor: 0.2,
          unidade: "mg/L",
          medidoEm: occurred,
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/medicoes", {
        method: "POST",
        body: {
          cicloId: p.cycle.id,
          parametroId: created.body.parametro.id,
          valor: 0.2,
          unidade: "mg/L",
          medidoEm: occurred,
          confirmarAnomalia: true,
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request(
        `/indicadores/evolucao?cicloId=${p.cycle.id}&parametroId=${created.body.parametro.id}`,
      )
    ).body.medicoes.length,
    1,
  );
});

test("WhatsApp exige configuração e autorização, prévia funciona e envio diário não duplica", async () => {
  const { queueDailySummary } = require("../dist/whatsapp/service");
  const p = await pond();
  const phone = `5585${String(Date.now()).slice(-9)}`;
  const body = {
    nome: `${prefix} contato`,
    telefone: phone,
    viveiroId: p.id,
    autorizado: true,
  };
  assert.equal(
    (
      await request("/whatsapp/contatos", {
        method: "POST",
        cookie: employeeCookie,
        body,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/whatsapp/contatos", {
        method: "POST",
        body: { ...body, autorizado: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/whatsapp/contatos", { method: "POST", body })).status,
    201,
  );
  const config = {
    ativo: false,
    horario: "18:00",
    fuso: "America/Sao_Paulo",
    nomeModelo: "resumo_diario",
    idiomaModelo: "pt_BR",
  };
  assert.equal(
    (await request("/whatsapp/config", { method: "PUT", body: config })).status,
    200,
  );
  const preview = await request(
    `/whatsapp/previa?dia=${yesterday}&viveiroId=${p.id}`,
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.body.conteudo.includes("CarciControl"), true);
  await assert.rejects(
    queueDailySummary(db, yesterday, {}),
    (error) => error.status === 409,
  );
  assert.equal(
    (
      await request("/whatsapp/enviar", {
        method: "POST",
        body: { dia: yesterday },
      })
    ).status,
    400,
  );
  const before = providerCalls;
  const results = await Promise.all(
    [1, 2].map(() =>
      request("/whatsapp/enviar", {
        method: "POST",
        body: { dia: yesterday, confirmar: true },
      }),
    ),
  );
  assert.equal(
    results.every((row) => row.status === 202),
    true,
  );
  assert.equal(providerCalls - before, 1);
  const history = await request("/whatsapp/envios");
  assert.equal(history.body.envios[0].status, "ACEITO");
  assert.equal(history.body.envios[0].tentativas, 1);
  assert.equal(
    (await request("/whatsapp/config")).body.integracao.configurado,
    true,
  );
});
test("webhook valida assinatura e confirmação de entrega não retrocede com eventos atrasados", async () => {
  const job = await db.envioWhatsApp.findFirst({
    where: { contato: { criadoPor: admin.id }, status: "ACEITO" },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = (status) => ({
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                {
                  id: job.mensagemProvedorId,
                  status,
                  timestamp,
                  recipient_id: job.telefoneDestino,
                },
              ],
            },
          },
        ],
      },
    ],
  });
  async function webhook(status, signed = true) {
    const body = JSON.stringify(payload(status));
    const signature = createHmac(
      "sha256",
      signed ? whatsappOptions.appSecret : "outro-segredo",
    )
      .update(body)
      .digest("hex");
    return fetch(base + "/whatsapp/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${signature}`,
      },
      body,
    });
  }
  assert.equal((await webhook("delivered", false)).status, 401);
  assert.equal((await webhook("delivered")).status, 200);
  assert.equal(
    (await db.envioWhatsApp.findUnique({ where: { id: job.id } })).status,
    "ENTREGUE",
  );
  assert.equal((await webhook("sent")).status, 200);
  assert.equal(
    (await db.envioWhatsApp.findUnique({ where: { id: job.id } })).status,
    "ENTREGUE",
  );
  assert.equal((await webhook("read")).status, 200);
  assert.equal(
    (await db.envioWhatsApp.findUnique({ where: { id: job.id } })).status,
    "LIDO",
  );
  const verify = await fetch(
    base +
      "/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verificacao-local&hub.challenge=12345",
  );
  assert.equal(verify.status, 200);
  assert.equal(await verify.text(), "12345");
});
test("timeout fica incerto e nunca é reenviado automaticamente", async () => {
  const day = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  providerMode = "timeout";
  const before = providerCalls;
  assert.equal(
    (
      await request("/whatsapp/enviar", {
        method: "POST",
        body: { dia: day, confirmar: true },
      })
    ).status,
    202,
  );
  const job = (await request(`/whatsapp/envios?dia=${day}`)).body.envios[0];
  assert.equal(job.status, "INCERTO");
  assert.equal(
    (
      await request("/whatsapp/enviar", {
        method: "POST",
        body: { dia: day, confirmar: true },
      })
    ).status,
    202,
  );
  assert.equal(providerCalls - before, 1);
  assert.equal(
    (
      await request(`/whatsapp/envios/${job.id}/repetir`, {
        method: "POST",
        body: { confirmar: true },
      })
    ).status,
    409,
  );
  providerMode = "ok";
});

test("agendamento usa o horário local e uma segunda execução não repete o resumo do dia", async () => {
  const { tickDailySummary } = require("../dist/whatsapp/service");
  const { DateTime } = require("luxon");
  const day = DateTime.now().setZone("America/Sao_Paulo").toISODate();
  await db.configResumoWhatsApp.update({
    where: { id: 1 },
    data: { ativo: true, horario: "18:00", fuso: "America/Sao_Paulo" },
  });
  const before = providerCalls;
  await tickDailySummary(
    scopedDb,
    new Date(`${day}T20:59:00Z`),
    whatsappOptions,
  );
  assert.equal(providerCalls, before);
  await tickDailySummary(
    scopedDb,
    new Date(`${day}T21:00:00Z`),
    whatsappOptions,
  );
  assert.equal(providerCalls, before + 1);
  await tickDailySummary(
    scopedDb,
    new Date(`${day}T21:01:00Z`),
    whatsappOptions,
  );
  assert.equal(providerCalls, before + 1);
});
