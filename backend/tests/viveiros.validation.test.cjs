const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validateNewViveiro, validateNewCycle, validateViveiroId } = require("../dist/viveiros/validation.js");

const pond = { identificador: "V-01", area: 1500, profundidadeMedia: 1.5 };
const cycle = { dataInicio: "2026-10-28", qtdLarvasInicial: 120000 };
const invalid = (validate, input) => assert.throws(() => validate(input), (error) => error.status === 400);

test("cadastro de viveiro normaliza textos e aceita localização opcional", () => {
  assert.deepEqual(validateNewViveiro({ ...pond, identificador: " V-01 ", localizacao: " Setor norte " }), {
    ...pond, localizacao: "Setor norte",
  });
  assert.equal(validateNewViveiro(pond).localizacao, null);
});

test("cadastro de viveiro rejeita campos extras, medidas inválidas e identificador vazio", () => {
  for (const input of [
    null, [], {}, { ...pond, identificador: " " }, { ...pond, identificador: "x".repeat(81) },
    { ...pond, identificador: "V\u000001" }, { ...pond, status: "OCUPADO" },
    { ...pond, area: 0 }, { ...pond, area: -1 }, { ...pond, area: "1500" },
    { ...pond, area: Infinity }, { ...pond, profundidadeMedia: NaN },
    { ...pond, profundidadeMedia: -1 }, { ...pond, localizacao: 10 },
  ]) invalid(validateNewViveiro, input);
});

test("povoamento converte datas de calendário para UTC e preserva dados básicos", () => {
  const result = validateNewCycle({ ...cycle, fornecedorLarvas: " Laboratório de teste ", previsaoDespesca: "2027-02-28" });
  assert.equal(result.dataInicio.toISOString(), "2026-10-28T00:00:00.000Z");
  assert.equal(result.previsaoDespesca.toISOString(), "2027-02-28T00:00:00.000Z");
  assert.equal(result.fornecedorLarvas, "Laboratório de teste");
  assert.equal(result.qtdLarvasInicial, 120000);
  assert.equal(validateNewCycle(cycle).previsaoDespesca, null);
  assert.equal(validateNewCycle(cycle).fornecedorLarvas, null);
  assert.equal(validateNewCycle({ ...cycle, dataInicio: "2024-02-29" }).dataInicio.getUTCDate(), 29);
});

test("povoamento exige quantidade inteira positiva e não aceita autoria ou status do cliente", () => {
  for (const input of [
    {}, { ...cycle, qtdLarvasInicial: 0 }, { ...cycle, qtdLarvasInicial: 1.5 },
    { ...cycle, qtdLarvasInicial: "120000" }, { ...cycle, qtdLarvasInicial: 2147483648 },
    { ...cycle, criadoPor: 1 }, { ...cycle, status: "FINALIZADO" }, { ...cycle, viveiroId: 1 },
  ]) invalid(validateNewCycle, input);
  assert.equal(validateNewCycle({ ...cycle, qtdLarvasInicial: 2147483647 }).qtdLarvasInicial, 2147483647);
});

test("datas impossíveis, horários ambíguos e previsão anterior ao povoamento são recusados", () => {
  for (const dataInicio of ["2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "28/10/2026", "2026-10-28T00:00:00Z", null]) {
    invalid(validateNewCycle, { ...cycle, dataInicio });
  }
  invalid(validateNewCycle, { ...cycle, previsaoDespesca: "2026-10-27" });
  invalid(validateNewCycle, { ...cycle, previsaoDespesca: "2027-02-30" });
});

test("rotas exigem ID inteiro positivo compatível com o banco", () => {
  for (const value of ["0", "-1", "01", "1.5", "1e2", "abc", "2147483648", "", undefined]) {
    invalid(validateViveiroId, value);
  }
  assert.equal(validateViveiroId("1"), 1);
  assert.equal(validateViveiroId("2147483647"), 2147483647);
});
