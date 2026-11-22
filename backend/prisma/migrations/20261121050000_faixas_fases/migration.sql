ALTER TABLE "FaixaParametro" ADD COLUMN "faseNome" TEXT,
 ADD COLUMN "diaInicial" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "diaFinal" INTEGER;
ALTER TABLE "FaixaParametro" ADD CONSTRAINT "FaixaParametro_dias_check" CHECK ("diaInicial" >= 0 AND ("diaFinal" IS NULL OR "diaFinal" >= "diaInicial"));
