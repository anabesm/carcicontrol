CREATE TYPE "StatusEnvioWhatsApp" AS ENUM ('PENDENTE','PROCESSANDO','ACEITO','ENVIADO','ENTREGUE','LIDO','FALHA','INCERTO');
CREATE TABLE "ConfigResumoWhatsApp" (
 "id" INTEGER PRIMARY KEY DEFAULT 1,
 "ativo" BOOLEAN NOT NULL DEFAULT false,
 "horario" VARCHAR(5) NOT NULL DEFAULT '18:00',
 "fuso" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
 "nomeModelo" TEXT,
 "idiomaModelo" TEXT NOT NULL DEFAULT 'pt_BR',
 "atualizadoPor" INTEGER NOT NULL,
 "atualizadoEm" TIMESTAMP(3) NOT NULL,
 CHECK ("id" = 1),
 CHECK ("horario" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE TABLE "ContatoWhatsApp" (
 "id" SERIAL PRIMARY KEY,
 "nome" TEXT NOT NULL,
 "telefone" VARCHAR(15) NOT NULL UNIQUE,
 "viveiroId" INTEGER REFERENCES "Viveiro"("id") ON DELETE RESTRICT,
 "ativo" BOOLEAN NOT NULL DEFAULT true,
 "autorizadoEm" TIMESTAMP(3) NOT NULL,
 "criadoPor" INTEGER NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "atualizadoEm" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "EnvioWhatsApp" (
 "id" SERIAL PRIMARY KEY,
 "contatoId" INTEGER NOT NULL REFERENCES "ContatoWhatsApp"("id") ON DELETE RESTRICT,
 "dia" VARCHAR(10) NOT NULL,
 "telefoneDestino" VARCHAR(15) NOT NULL,
 "conteudo" TEXT NOT NULL,
 "origem" TEXT NOT NULL DEFAULT 'AGENDADO',
 "status" "StatusEnvioWhatsApp" NOT NULL DEFAULT 'PENDENTE',
 "tentativas" INTEGER NOT NULL DEFAULT 0,
 "mensagemProvedorId" TEXT UNIQUE,
 "erro" TEXT,
 "ultimoStatusEm" TIMESTAMP(3),
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "atualizadoEm" TIMESTAMP(3) NOT NULL,
 UNIQUE ("contatoId", "dia")
);
CREATE INDEX "EnvioWhatsApp_status_criadoEm_idx" ON "EnvioWhatsApp"("status", "criadoEm");
