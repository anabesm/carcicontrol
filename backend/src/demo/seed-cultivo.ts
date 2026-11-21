import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { seedDemoMedicoes } from "./seed-medicoes";
import { parametroConfigSelect } from "../medicoes/selects";
import { resolveFaixa } from "../medicoes/rules";

export async function seedDemoCultivo(db: PrismaClient, adminId: number) {
  await seedDemoMedicoes(db, adminId);
  const parameters = await db.parametro.findMany({
    where: {
      ativo: true,
      codigo: { in: ["OD", "TEMPERATURA", "SALINIDADE", "PH"] },
    },
    select: parametroConfigSelect,
  });
  let created = 0;
  for (const mode of ["ATIVO", "VENDA", "PERDA_TOTAL"] as const) {
    const identificador = `DEMO - ${mode === "ATIVO" ? "Cultivo ativo" : mode === "VENDA" ? "Despesca com venda" : "Perda total"}`;
    const wasCreated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9172610)`;
      if (
        await tx.viveiro.findUnique({
          where: { identificador },
          select: { id: true },
        })
      )
        return false;
      if (
        !(await tx.usuario.findFirst({
          where: { id: adminId, perfil: "ADMINISTRADOR", status: "ATIVO" },
        }))
      )
        throw new HttpError(403, "Use um administrador ativo.");
      const now = Date.now();
      const dataInicio = new Date(now - 10 * 86400000);
      const medidoEm = new Date(now - 2 * 3600000);
      const dataEncerramento =
        mode === "ATIVO" ? null : new Date(now - 3600000);
      const viveiro = await tx.viveiro.create({
        data: {
          identificador,
          area: 10000,
          profundidadeMedia: 1.5,
          localizacao: "Dados fictícios de demonstração",
          status: mode === "ATIVO" ? "OCUPADO" : "DISPONIVEL",
        },
      });
      const ciclo = await tx.cicloCultivo.create({
        data: {
          viveiroId: viveiro.id,
          criadoPor: adminId,
          dataInicio,
          qtdLarvasInicial: 100000,
          fornecedorLarvas: "Fornecedor fictício",
          status: mode === "ATIVO" ? "ATIVO" : "FINALIZADO",
          dataEncerramento,
          ...(mode === "ATIVO"
            ? {}
            : {
                motivoEncerramento: mode,
                pesoFinal: mode === "VENDA" ? 1800 : 0,
                quantidadeFinal: mode === "VENDA" ? 75000 : 0,
                observacaoEncerramento:
                  mode === "VENDA"
                    ? "Despesca fictícia para demonstração."
                    : "Perda fictícia para demonstração.",
              }),
        },
      });
      for (const parameter of parameters) {
        const range = resolveFaixa(parameter);
        const value = (range.minIdeal + range.maxIdeal) / 2;
        await tx.medicao.create({
          data: {
            cicloId: ciclo.id,
            parametroId: parameter.id,
            valor: value,
            unidade: parameter.unidadePadrao,
            medidoEm,
            registradoPorId: adminId,
            faixaParametroId: range.id,
            minIdealAplicado: range.minIdeal,
            maxIdealAplicado: range.maxIdeal,
            faixaDemonstrativa: range.demonstrativa,
          },
        });
        if (
          mode === "ATIVO" &&
          parameter.codigo === "OD" &&
          range.minIdeal > parameter.minPossivel!
        ) {
          const valor = Math.max(parameter.minPossivel!, range.minIdeal - 1);
          await tx.medicao.create({
            data: {
              cicloId: ciclo.id,
              parametroId: parameter.id,
              valor,
              unidade: parameter.unidadePadrao,
              medidoEm: new Date(medidoEm.getTime() + 60000),
              registradoPorId: adminId,
              confirmadaForaFaixa: true,
              faixaParametroId: range.id,
              minIdealAplicado: range.minIdeal,
              maxIdealAplicado: range.maxIdeal,
              faixaDemonstrativa: range.demonstrativa,
              alertas: {
                create: {
                  valorMedido: valor,
                  limiteViolado: `Abaixo do mínimo ideal de ${range.minIdeal} ${parameter.unidadePadrao}`,
                  gravidade: "MEDIA",
                  observacao: "Dados fictícios de demonstração.",
                },
              },
            },
          });
        }
      }
      await tx.compraDespesa.create({
        data: {
          viveiroId: viveiro.id,
          cicloId: ciclo.id,
          data: new Date(now - 86400000),
          fornecedorNome: "Fornecedor fictício",
          valorTotal: 300,
          statusPagamento: "PAGO",
          observacao: "Dados fictícios de demonstração.",
          criadoPor: adminId,
          itens: {
            create: {
              categoria: "RACAO",
              descricao: "Ração de demonstração",
              quantidade: 10,
              unidade: "kg",
              valorUnit: 30,
              valorTotalItem: 300,
            },
          },
        },
      });
      await tx.eventoOperacional.create({
        data: {
          viveiroId: viveiro.id,
          cicloId: ciclo.id,
          dataHora: medidoEm,
          tipo: "MANUTENCAO",
          descricao: "Verificação fictícia de aerador.",
          criadoPor: adminId,
        },
      });
      if (dataEncerramento) {
        await tx.eventoOperacional.create({
          data: {
            viveiroId: viveiro.id,
            cicloId: ciclo.id,
            dataHora: dataEncerramento,
            tipo: `ENCERRAMENTO_${mode}`,
            descricao: "Encerramento fictício de demonstração.",
            criadoPor: adminId,
          },
        });
        if (mode === "VENDA")
          await tx.venda.create({
            data: {
              viveiroId: viveiro.id,
              cicloId: ciclo.id,
              data: dataEncerramento,
              compradorNome: "Comprador fictício",
              pesoTotalKg: 1800,
              precoPorKg: 25,
              valorTotal: 45000,
              observacao: "Dados fictícios de demonstração.",
              criadoPor: adminId,
            },
          });
      }
      return true;
    });
    if (wasCreated) created++;
  }
  return { created, preserved: 3 - created };
}
