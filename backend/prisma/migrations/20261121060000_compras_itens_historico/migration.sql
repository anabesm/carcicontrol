ALTER TABLE "CompraDespesa" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "atualizadoEm" TIMESTAMP(3);
UPDATE "CompraDespesa" SET "atualizadoEm" = "criadoEm";
ALTER TABLE "CompraDespesa" ALTER COLUMN "atualizadoEm" SET NOT NULL,
 ALTER COLUMN "atualizadoEm" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE "AlteracaoDespesa" (
 "id" SERIAL PRIMARY KEY,
 "compraId" INTEGER NOT NULL REFERENCES "CompraDespesa"("id") ON DELETE CASCADE,
 "usuarioId" INTEGER NOT NULL,
 "dadosAnteriores" JSONB NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AlteracaoDespesa_compraId_criadoEm_idx" ON "AlteracaoDespesa"("compraId", "criadoEm");
