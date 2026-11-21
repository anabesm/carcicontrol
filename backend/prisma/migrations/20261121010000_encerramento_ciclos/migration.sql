CREATE TYPE "MotivoEncerramento" AS ENUM ('VENDA', 'PERDA_TOTAL');
ALTER TABLE "CicloCultivo" ADD COLUMN "motivoEncerramento" "MotivoEncerramento",
  ADD COLUMN "observacaoEncerramento" TEXT,
  ADD COLUMN "quantidadeFinal" INTEGER;
CREATE UNIQUE INDEX "Venda_cicloId_key" ON "Venda"("cicloId");
ALTER TABLE "CicloCultivo" ADD CONSTRAINT "CicloCultivo_quantidadeFinal_check" CHECK ("quantidadeFinal" IS NULL OR "quantidadeFinal" >= 0);
