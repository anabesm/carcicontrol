const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validateNewMedicao, historyQuery } = require("../dist/medicoes/validation");
const { assessValue, resolveFaixa } = require("../dist/medicoes/rules");

const now = new Date("2026-10-29T12:00:00Z");
const input = { cicloId: 1, parametroId: 1, valor: 6, unidade: "mg/L", medidoEm: "2026-10-29T08:30:00-03:00" };
const range = { id: 1, viveiroId: null, minIdeal: 5, maxIdeal: 7, minCritico: 3, maxCritico: 10, demonstrativa: true, descricao: "Exemplo" };
const parameter = { id: 1, codigo: "OD", nome: "Oxigênio dissolvido", unidadePadrao: "mg/L", minPossivel: 0, maxPossivel: 30, ativo: true, faixas: [range] };
const invalid = (value) => assert.throws(() => validateNewMedicao(value, now), (error) => error.status === 400);

test("medição aceita horário explícito com fuso e não confirma anomalia implicitamente", () => {
  const value = validateNewMedicao(input, now);
  assert.equal(value.medidoEm.toISOString(), "2026-10-29T11:30:00.000Z");
  assert.equal(value.confirmarAnomalia, false);
  assert.equal(validateNewMedicao({ ...input, confirmarAnomalia: true }, now).confirmarAnomalia, true);
});

test("campos inválidos e tentativa de informar responsável ou faixa são recusados", () => {
  for (const value of [
    null, [], {}, { ...input, cicloId: "1" }, { ...input, cicloId: 0 }, { ...input, parametroId: 1.5 },
    { ...input, valor: "6" }, { ...input, valor: NaN }, { ...input, valor: Infinity }, { ...input, unidade: " " },
    { ...input, registradoPorId: 2 }, { ...input, faixaParametroId: 2 }, { ...input, gravidade: "BAIXA" },
    { ...input, confirmarAnomalia: "true" }, { ...input, confirmarAnomalia: 1 }, { ...input, confirmarAnomalia: null },
  ]) invalid(value);
});

test("datas impossíveis, sem fuso e futuras são recusadas", () => {
  for (const medidoEm of [
    "2026-10-29T08:30:00", "2026-02-30T00:00:00Z", "2026-10-29T24:00:00Z",
    "2026-10-29T08:61:00Z", "2026-10-29T08:30:60Z", "0000-01-01T00:00:00Z", "2026-10-29T12:00:01Z", "amanhã",
  ]) invalid({ ...input, medidoEm });
});

test("limites aceitos e ideais são inclusivos e valores impossíveis não viram anomalias confirmáveis", () => {
  for (const value of [5, 6, 7]) assert.equal(assessValue(parameter, range, value).direction, null);
  assert.equal(assessValue(parameter, range, 0).direction, "ABAIXO");
  assert.equal(assessValue(parameter, range, 30).direction, "ACIMA");
  for (const value of [-0.01, 30.01, NaN, Infinity]) assert.throws(() => assessValue(parameter, range, value), (error) => error.status === 400);
  assert.equal(assessValue(parameter, range, 4).gravidade, "MEDIA");
  assert.equal(assessValue(parameter, range, 2).gravidade, "ALTA");
});

test("faixa do viveiro prevalece e configurações ausentes, ambíguas ou incoerentes falham", () => {
  const local = { ...range, id: 2, viveiroId: 10, minIdeal: 6, maxIdeal: 8 };
  assert.equal(resolveFaixa({ ...parameter, faixas: [range, local] }, 10).id, 2);
  assert.equal(resolveFaixa({ ...parameter, faixas: [range, local] }, 20).id, 1);
  for (const value of [
    { ...parameter, faixas: [] }, { ...parameter, faixas: [range, { ...range, id: 3 }] },
    { ...parameter, minPossivel: null }, { ...parameter, faixas: [{ ...range, maxIdeal: 31 }] },
    { ...parameter, faixas: [{ ...range, minIdeal: 8 }] },
  ]) assert.throws(() => resolveFaixa(value, 10), (error) => error.status === 503);
});

test("histórico valida filtros e limita o tamanho da consulta", () => {
  assert.equal(historyQuery({}).limite, 50);
  assert.equal(historyQuery({ cicloId: "1", limite: "10", offset: "20" }).offset, 20);
  for (const query of [{ limite: "101" }, { offset: "-1" }, { cicloId: ["1", "2"] }, { status: "PENDENTE" }, { extra: "1" }]) {
    assert.throws(() => historyQuery(query), (error) => error.status === 400);
  }
  assert.equal(historyQuery({ status: "PENDENTE" }, true).status, "PENDENTE");
});
