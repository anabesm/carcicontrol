CREATE TABLE "RotinaMedicao" (
 "id" SERIAL PRIMARY KEY,
 "parametroId" INTEGER NOT NULL REFERENCES "Parametro"("id") ON DELETE CASCADE,
 "viveiroId" INTEGER REFERENCES "Viveiro"("id") ON DELETE CASCADE,
 "horario" VARCHAR(5) NOT NULL,
 "fuso" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
 "toleranciaMinutos" INTEGER NOT NULL DEFAULT 60,
 "ativo" BOOLEAN NOT NULL DEFAULT true,
 "criadoPor" INTEGER NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "atualizadoEm" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "RotinaMedicao_tolerancia_check" CHECK ("toleranciaMinutos" BETWEEN 1 AND 180),
 CONSTRAINT "RotinaMedicao_horario_check" CHECK ("horario" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE INDEX "RotinaMedicao_parametroId_viveiroId_ativo_idx" ON "RotinaMedicao"("parametroId", "viveiroId", "ativo");
CREATE UNIQUE INDEX "RotinaMedicao_horario_ativo_key" ON "RotinaMedicao"("parametroId", COALESCE("viveiroId",0), "horario") WHERE "ativo";
