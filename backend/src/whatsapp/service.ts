import type { PrismaClient } from "@prisma/client";
import { DateTime, IANAZone } from "luxon";
import { HttpError } from "../lib/http-error";
import { bodyObject, date, optionalId, optionalText, text } from "../lib/input";
import {
  providerStatus,
  sendTemplate,
  whatsAppOptions,
  type WhatsAppOptions,
} from "./provider";
export const defaultConfig = {
  id: 1,
  ativo: false,
  horario: "18:00",
  fuso: "America/Sao_Paulo",
  nomeModelo: null as string | null,
  idiomaModelo: "pt_BR",
};
export async function getConfig(db: PrismaClient) {
  return (
    (await db.configResumoWhatsApp.findUnique({ where: { id: 1 } })) ??
    defaultConfig
  );
}
export function validateConfig(value: unknown) {
  const body = bodyObject(value, [
    "ativo",
    "horario",
    "fuso",
    "nomeModelo",
    "idiomaModelo",
  ]);
  if (typeof body.ativo !== "boolean")
    throw new HttpError(400, "Informe se o agendamento está ativo.");
  const horario = text(body.horario, "Horário", 5),
    fuso = text(body.fuso, "Fuso", 80);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario) || !IANAZone.isValidZone(fuso))
    throw new HttpError(400, "Horário ou fuso inválido.");
  const nomeModelo = optionalText(body.nomeModelo, "Nome do modelo", 512);
  const idiomaModelo = text(body.idiomaModelo, "Idioma do modelo", 20);
  if (
    (nomeModelo && !/^[a-z0-9_]+$/.test(nomeModelo)) ||
    !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(idiomaModelo)
  )
    throw new HttpError(400, "Nome ou idioma do modelo inválido.");
  return { ativo: body.ativo, horario, fuso, nomeModelo, idiomaModelo };
}
export function validateContact(value: unknown) {
  const body = bodyObject(value, [
    "nome",
    "telefone",
    "viveiroId",
    "ativo",
    "autorizado",
  ]);
  if (body.autorizado !== true)
    throw new HttpError(
      400,
      "Confirme a autorização do destinatário para receber os resumos.",
    );
  const telefone = text(body.telefone, "Telefone", 16).replace(/^\+/, "");
  if (!/^[1-9]\d{9,14}$/.test(telefone))
    throw new HttpError(
      400,
      "Use código do país, DDD e número, somente dígitos.",
    );
  if (body.ativo !== undefined && typeof body.ativo !== "boolean")
    throw new HttpError(400, "Situação do contato inválida.");
  return {
    nome: text(body.nome, "Nome", 120),
    telefone,
    viveiroId: optionalId(body.viveiroId),
    ativo: body.ativo !== false,
  };
}
export async function buildDailySummary(
  db: PrismaClient,
  day: string,
  zone: string,
  viveiroId?: number | null,
) {
  date(day, "Dia", true);
  const beginning = DateTime.fromISO(day, { zone }).startOf("day");
  if (!beginning.isValid) throw new HttpError(400, "Dia ou fuso inválido.");
  const period = {
    gte: beginning.toJSDate(),
    lte: beginning.endOf("day").toJSDate(),
  };
  const [readings, events] = await Promise.all([
    db.medicao.findMany({
      where: {
        medidoEm: period,
        ...(viveiroId ? { ciclo: { viveiroId } } : {}),
      },
      include: {
        parametro: { select: { nome: true } },
        ciclo: {
          select: { id: true, viveiro: { select: { identificador: true } } },
        },
        alertas: { select: { id: true } },
      },
      orderBy: [{ medidoEm: "asc" }, { id: "asc" }],
    }),
    db.eventoOperacional.findMany({
      where: { dataHora: period, ...(viveiroId ? { viveiroId } : {}) },
      include: { viveiro: { select: { identificador: true } } },
      orderBy: [{ dataHora: "asc" }, { id: "asc" }],
    }),
  ]);
  const parts = [`CarciControl ${beginning.toFormat("dd/MM/yyyy")}`];
  const groups = new Map<
    string,
    {
      name: string;
      last: (typeof readings)[number];
      count: number;
      alerts: number;
    }
  >();
  for (const row of readings) {
    const key = `${row.cicloId}:${row.parametroId}`,
      old = groups.get(key);
    groups.set(key, {
      name: `${row.ciclo.viveiro.identificador}, ciclo #${row.cicloId}, ${row.parametro.nome}`,
      last: row,
      count: (old?.count ?? 0) + 1,
      alerts: (old?.alerts ?? 0) + row.alertas.length,
    });
  }
  for (const group of groups.values())
    parts.push(
      `${group.name}: última ${group.last.valor} ${group.last.unidade}, ${group.count} leituras, ${group.alerts} alertas`,
    );
  for (const event of events)
    parts.push(
      `${event.viveiro.identificador}${event.cicloId ? `, ciclo #${event.cicloId}` : ""}: ${event.tipo}, ${event.descricao}`,
    );
  if (!readings.length && !events.length)
    parts.push("Nenhuma medição ou ocorrência registrada no dia.");
  const all = parts.join(" / ").replace(/\s+/g, " ").trim();
  const conteudo =
    all.length > 1000
      ? all.slice(0, 945) +
        "… Resumo limitado. Consulte o sistema para todos os registros."
      : all;
  return {
    dia: day,
    fuso: zone,
    conteudo,
    medicoes: readings.length,
    ocorrencias: events.length,
    limitado: all.length > 1000,
  };
}
export async function queueDailySummary(
  db: PrismaClient,
  day: string,
  options: WhatsAppOptions = whatsAppOptions(),
  manual = false,
) {
  const config = await getConfig(db);
  if (!providerStatus(options).configurado || !config.nomeModelo)
    throw new HttpError(
      409,
      "Configure a integração e o modelo aprovado antes de enviar.",
    );
  const contacts = await db.contatoWhatsApp.findMany({
    where: { ativo: true },
  });
  if (!contacts.length)
    throw new HttpError(409, "Cadastre um destinatário autorizado e ativo.");
  let created = 0;
  const existing = new Set(
    (
      await db.envioWhatsApp.findMany({
        where: {
          dia: day,
          contatoId: { in: contacts.map((contact) => contact.id) },
        },
        select: { contatoId: true },
      })
    ).map((row) => row.contatoId),
  );
  for (const contact of contacts) {
    if (existing.has(contact.id)) continue;
    const report = await buildDailySummary(
      db,
      day,
      config.fuso,
      contact.viveiroId,
    );
    const result = await db.envioWhatsApp.createMany({
      data: [
        {
          contatoId: contact.id,
          dia: day,
          telefoneDestino: contact.telefone,
          conteudo: report.conteudo,
          origem: manual ? "MANUAL" : "AGENDADO",
        },
      ],
      skipDuplicates: true,
    });
    created += result.count;
  }
  if (manual)
    await db.envioWhatsApp.updateMany({
      where: {
        dia: day,
        status: "PENDENTE",
        contatoId: { in: contacts.map((contact) => contact.id) },
      },
      data: { origem: "MANUAL" },
    });
  return { criados: created, contatos: contacts.length };
}
export async function processDeliveries(
  db: PrismaClient,
  options: WhatsAppOptions = whatsAppOptions(),
) {
  const config = await getConfig(db);
  if (!providerStatus(options).configurado || !config.nomeModelo) return;
  await db.envioWhatsApp.updateMany({
    where: {
      status: "PROCESSANDO",
      atualizadoEm: { lt: new Date(Date.now() - 10 * 60000) },
    },
    data: {
      status: "INCERTO",
      erro: "Processamento interrompido. Confirme no provedor antes de reenviar.",
    },
  });
  const rows = await db.envioWhatsApp.findMany({
    where: {
      status: "PENDENTE",
      ...(config.ativo ? {} : { origem: "MANUAL" }),
    },
    include: { contato: true },
    orderBy: { id: "asc" },
    take: 20,
  });
  for (const row of rows) {
    if (!row.contato.ativo || row.contato.telefone !== row.telefoneDestino) {
      await db.envioWhatsApp.updateMany({
        where: { id: row.id, status: "PENDENTE" },
        data: {
          status: "FALHA",
          erro: "Contato desativado ou alterado antes do envio.",
        },
      });
      continue;
    }
    const claimed = await db.envioWhatsApp.updateMany({
      where: { id: row.id, status: "PENDENTE" },
      data: { status: "PROCESSANDO", tentativas: { increment: 1 }, erro: null },
    });
    if (!claimed.count) continue;
    const result = await sendTemplate(options, {
      id: row.id,
      phone: row.telefoneDestino,
      text: row.conteudo,
      template: config.nomeModelo,
      language: config.idiomaModelo,
    });
    await db.envioWhatsApp.updateMany({
      where: { id: row.id, status: "PROCESSANDO" },
      data:
        result.status === "ACEITO"
          ? {
              status: "ACEITO",
              mensagemProvedorId: result.messageId,
              ultimoStatusEm: new Date(),
            }
          : {
              status: result.status,
              erro: result.error,
              ultimoStatusEm: new Date(),
            },
    });
  }
}
export async function tickDailySummary(
  db: PrismaClient,
  now = new Date(),
  options: WhatsAppOptions = whatsAppOptions(),
) {
  const config = await getConfig(db);
  if (!providerStatus(options).configurado || !config.nomeModelo) return;
  const local = DateTime.fromJSDate(now, { zone: config.fuso });
  if (config.ativo && local.toFormat("HH:mm") >= config.horario)
    await queueDailySummary(db, local.toISODate()!, options);
  await processDeliveries(db, options);
}
export function startDailySummaryWorker(db: PrismaClient) {
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    void tickDailySummary(db)
      .catch(() =>
        console.error(
          "Não foi possível processar o resumo diário. Verifique a configuração.",
        ),
      )
      .finally(() => {
        busy = false;
      });
  };
  const timer = setInterval(run, 60000);
  timer.unref();
  run();
  return () => clearInterval(timer);
}
