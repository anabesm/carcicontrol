-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMINISTRADOR', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "StatusGeral" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusViveiro" AS ENUM ('DISPONIVEL', 'OCUPADO', 'MANUTENCAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusCiclo" AS ENUM ('ATIVO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "GravidadeAlerta" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "StatusAlerta" AS ENUM ('PENDENTE', 'RESOLVIDO', 'IGNORADO');

-- CreateEnum
CREATE TYPE "CategoriaDespesa" AS ENUM ('RACAO', 'ENERGIA', 'INSUMOS_QUIMICOS', 'BIOLOGICOS', 'MANUTENCAO', 'MAO_DE_OBRA', 'OUTROS');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "telefone" TEXT,
    "perfil" "PerfilUsuario" NOT NULL,
    "status" "StatusGeral" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viveiro" (
    "id" SERIAL NOT NULL,
    "identificador" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "profundidadeMedia" DOUBLE PRECISION NOT NULL,
    "localizacao" TEXT,
    "status" "StatusViveiro" NOT NULL DEFAULT 'DISPONIVEL',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Viveiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloCultivo" (
    "id" SERIAL NOT NULL,
    "viveiroId" INTEGER NOT NULL,
    "status" "StatusCiclo" NOT NULL DEFAULT 'ATIVO',
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "qtdLarvasInicial" INTEGER NOT NULL,
    "fornecedorLarvas" TEXT,
    "previsaoDespesca" TIMESTAMP(3),
    "dataEncerramento" TIMESTAMP(3),
    "pesoFinal" DOUBLE PRECISION,
    "criadoPor" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CicloCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametro" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidadePadrao" TEXT NOT NULL,
    "minPossivel" DOUBLE PRECISION,
    "maxPossivel" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaixaParametro" (
    "id" SERIAL NOT NULL,
    "parametroId" INTEGER NOT NULL,
    "viveiroId" INTEGER,
    "minIdeal" DOUBLE PRECISION NOT NULL,
    "maxIdeal" DOUBLE PRECISION NOT NULL,
    "minCritico" DOUBLE PRECISION,
    "maxCritico" DOUBLE PRECISION,
    "minAcaoRecomendada" TEXT,
    "maxAcaoRecomendada" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaixaParametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicao" (
    "id" SERIAL NOT NULL,
    "parametroId" INTEGER NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "registradoPorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" SERIAL NOT NULL,
    "medicaoId" INTEGER NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorMedido" DOUBLE PRECISION NOT NULL,
    "limiteViolado" TEXT NOT NULL,
    "gravidade" "GravidadeAlerta" NOT NULL,
    "status" "StatusAlerta" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "resolvidoPorId" INTEGER,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraDespesa" (
    "id" SERIAL NOT NULL,
    "viveiroId" INTEGER,
    "cicloId" INTEGER,
    "data" TIMESTAMP(3) NOT NULL,
    "fornecedorNome" TEXT,
    "numeroDocumento" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "formaPagamento" TEXT,
    "statusPagamento" TEXT,
    "observacao" TEXT,
    "criadoPor" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraDespesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCompra" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "categoria" "CategoriaDespesa" NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "valorUnit" DOUBLE PRECISION NOT NULL,
    "valorTotalItem" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "ItemCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" SERIAL NOT NULL,
    "viveiroId" INTEGER NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "compradorNome" TEXT NOT NULL,
    "pesoTotalKg" DOUBLE PRECISION NOT NULL,
    "precoPorKg" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "biometria" TEXT,
    "observacao" TEXT,
    "criadoPor" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoOperacional" (
    "id" SERIAL NOT NULL,
    "viveiroId" INTEGER NOT NULL,
    "cicloId" INTEGER,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION,
    "criadoPor" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoOperacional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Viveiro_identificador_key" ON "Viveiro"("identificador");

-- CreateIndex
CREATE UNIQUE INDEX "Parametro_codigo_key" ON "Parametro"("codigo");

-- AddForeignKey
ALTER TABLE "CicloCultivo" ADD CONSTRAINT "CicloCultivo_viveiroId_fkey" FOREIGN KEY ("viveiroId") REFERENCES "Viveiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaixaParametro" ADD CONSTRAINT "FaixaParametro_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "Parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaixaParametro" ADD CONSTRAINT "FaixaParametro_viveiroId_fkey" FOREIGN KEY ("viveiroId") REFERENCES "Viveiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "Parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloCultivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES "Medicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraDespesa" ADD CONSTRAINT "CompraDespesa_viveiroId_fkey" FOREIGN KEY ("viveiroId") REFERENCES "Viveiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraDespesa" ADD CONSTRAINT "CompraDespesa_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCompra" ADD CONSTRAINT "ItemCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "CompraDespesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_viveiroId_fkey" FOREIGN KEY ("viveiroId") REFERENCES "Viveiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloCultivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOperacional" ADD CONSTRAINT "EventoOperacional_viveiroId_fkey" FOREIGN KEY ("viveiroId") REFERENCES "Viveiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoOperacional" ADD CONSTRAINT "EventoOperacional_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
