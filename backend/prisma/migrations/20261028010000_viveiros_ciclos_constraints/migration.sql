BEGIN;

-- Mantém os identificadores existentes e impede novos equivalentes por caixa/espaços.
CREATE UNIQUE INDEX "Viveiro_identificador_normalizado_key"
ON "Viveiro" (LOWER(BTRIM("identificador")));

-- Ciclos históricos não participam da restrição de unicidade.
CREATE UNIQUE INDEX "CicloCultivo_um_ativo_por_viveiro_key"
ON "CicloCultivo" ("viveiroId") WHERE "status" = 'ATIVO';

CREATE INDEX "CicloCultivo_viveiroId_dataInicio_id_idx"
ON "CicloCultivo" ("viveiroId", "dataInicio", "id");

COMMIT;
