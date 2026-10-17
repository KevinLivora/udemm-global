-- ============================================================
-- MOD-AUT Fase 2B.1 — Migración base
-- Cambios: G-04, G-13, G-14
-- ESTADO: PREPARADA — NO EJECUTAR sin autorización expresa.
-- Sin DROP TABLE, DROP COLUMN ni UPDATE masivo.
-- Compatible con PostgreSQL. Segura para datos existentes.
-- ============================================================

-- ── G-04: Umbrales horarios en PlanEstudio (P-10..P-14) ─────────────────────
-- NULL = sin umbral configurado. R-09 no evalúa ese bloque.
-- Los planes existentes quedan con NULL — sin impacto operativo.

ALTER TABLE "PlanEstudio"
  ADD COLUMN IF NOT EXISTS "horasMinTotales" INTEGER,
  ADD COLUMN IF NOT EXISTS "horasMinCB"      INTEGER,
  ADD COLUMN IF NOT EXISTS "horasMinTB"      INTEGER,
  ADD COLUMN IF NOT EXISTS "horasMinTA"      INTEGER,
  ADD COLUMN IF NOT EXISTS "horasMinCTX"     INTEGER;

-- ── G-13: Responsable de cátedra en VinculacionCatedra ──────────────────────
-- NULL = sin clasificar (estado inicial de todos los registros existentes).
-- true = responsable confirmado. false = confirmado no responsable.
-- SIN DEFAULT → los registros existentes conservan NULL.

ALTER TABLE "VinculacionCatedra"
  ADD COLUMN IF NOT EXISTS "esResponsableCatedra" BOOLEAN;

-- Índice de consulta para la evaluación de indicadores (planEstudio + responsable)
CREATE INDEX IF NOT EXISTS "VinculacionCatedra_planEstudioId_esResponsableCatedra_idx"
  ON "VinculacionCatedra" ("planEstudioId", "esResponsableCatedra");

-- Índice de consulta materia + cátedra (para R-02, R-08, RC)
CREATE INDEX IF NOT EXISTS "VinculacionCatedra_materiaId_catedraId_idx"
  ON "VinculacionCatedra" ("materiaId", "catedraId");

-- Índice parcial único: a lo sumo UN responsable APROBADO por (materia, cátedra).
-- Filtra por estado='APROBADA' para que las vinculaciones DESVINCULADAS/RECHAZADAS/PENDIENTES
-- con esResponsableCatedra=true no bloqueen nuevas designaciones activas (H-01).
-- El servicio verifica esto antes del update (para devolver 409 legible). El índice es la
-- segunda línea de defensa ante escrituras concurrentes (H-02 → P2002 → 409).
CREATE UNIQUE INDEX IF NOT EXISTS "VinculacionCatedra_responsable_materia_catedra_unique"
  ON "VinculacionCatedra" ("materiaId", "catedraId")
  WHERE "esResponsableCatedra" = true AND "estado" = 'APROBADA';

-- ── G-14: Configuración de MOD-AUT por Facultad ─────────────────────────────
-- P-01: tope semanal (R-03). P-02: baja dedicación (R-10). P-03: sobreasignación (R-07).
-- Una sola configuración por Facultad (UNIQUE en facultadId).
-- updatedBy: UUID del usuario ADMINISTRADOR_SISTEMA que realizó el último cambio.
-- M-01: p01/p02/p03 SIN DEFAULT — valores institucionales pendientes de aprobación.
--       La API exige los tres parámetros al crear una configuración nueva.

CREATE TABLE IF NOT EXISTS "autoevaluacion_config_facultad" (
  "id"         TEXT         NOT NULL,
  "facultadId" TEXT         NOT NULL,
  "p01TopeH"   INTEGER      NOT NULL,
  "p02BajaH"   INTEGER      NOT NULL,
  "p03MaxMat"  INTEGER      NOT NULL,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy"  TEXT,

  CONSTRAINT "autoevaluacion_config_facultad_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "autoevaluacion_config_facultad_facultadId_fkey"
    FOREIGN KEY ("facultadId") REFERENCES "Facultad"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "autoevaluacion_config_facultad_facultadId_key"
  ON "autoevaluacion_config_facultad" ("facultadId");

-- Trigger para updatedAt automático en PostgreSQL
-- (Prisma genera esto internamente, pero se incluye para uso manual si aplica)
-- Si Prisma maneja updatedAt via @updatedAt, este trigger puede no ser necesario.
