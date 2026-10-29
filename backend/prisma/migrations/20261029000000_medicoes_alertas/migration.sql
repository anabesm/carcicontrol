BEGIN;

ALTER TABLE "FaixaParametro"
ADD COLUMN "descricao" TEXT,
ADD COLUMN "demonstrativa" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Medicao"
ADD COLUMN "unidade" TEXT,
ADD COLUMN "medidoEm" TIMESTAMP(3),
ADD COLUMN "confirmadaForaFaixa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "faixaParametroId" INTEGER,
ADD COLUMN "minIdealAplicado" DOUBLE PRECISION,
ADD COLUMN "maxIdealAplicado" DOUBLE PRECISION,
ADD COLUMN "faixaDemonstrativa" BOOLEAN NOT NULL DEFAULT false;

-- Preserva os registros anteriores usando os dados disponíveis antes desta migration.
UPDATE "Medicao" AS m
SET "unidade" = p."unidadePadrao", "medidoEm" = m."criadoEm"
FROM "Parametro" AS p WHERE p."id" = m."parametroId";

ALTER TABLE "Medicao"
ALTER COLUMN "unidade" SET NOT NULL,
ALTER COLUMN "medidoEm" SET NOT NULL;

ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_faixaParametroId_fkey"
FOREIGN KEY ("faixaParametroId") REFERENCES "FaixaParametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FaixaParametro_parametroId_viveiroId_ativo_idx" ON "FaixaParametro"("parametroId", "viveiroId", "ativo");
CREATE INDEX "Medicao_cicloId_medidoEm_id_idx" ON "Medicao"("cicloId", "medidoEm", "id");
CREATE INDEX "Medicao_parametroId_medidoEm_id_idx" ON "Medicao"("parametroId", "medidoEm", "id");
CREATE INDEX "Alerta_medicaoId_idx" ON "Alerta"("medicaoId");
CREATE INDEX "Alerta_status_dataHora_id_idx" ON "Alerta"("status", "dataHora", "id");

COMMIT;
