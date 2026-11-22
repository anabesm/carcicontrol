ALTER TABLE "CicloCultivo" ADD COLUMN "areaPovoamentoM2" DOUBLE PRECISION;
ALTER TABLE "CicloCultivo" ADD CONSTRAINT "CicloCultivo_areaPovoamentoM2_check" CHECK ("areaPovoamentoM2" IS NULL OR "areaPovoamentoM2" > 0);
