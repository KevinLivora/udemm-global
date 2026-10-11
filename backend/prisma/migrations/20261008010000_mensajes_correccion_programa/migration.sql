-- AlterTable: Notificacion — agregar solicitudProgramaId (nullable)
ALTER TABLE "Notificacion" ADD COLUMN "solicitudProgramaId" TEXT;

-- CreateTable: MensajeCorrecionPrograma
CREATE TABLE "MensajeCorrecionPrograma" (
    "id"            TEXT NOT NULL,
    "solicitudId"   TEXT NOT NULL,
    "programaId"    TEXT NOT NULL,
    "usuarioId"     TEXT NOT NULL,
    "rolNombre"     TEXT NOT NULL,
    "contenido"     TEXT NOT NULL,
    "tipo"          TEXT NOT NULL,
    "leido"         BOOLEAN NOT NULL DEFAULT false,
    "fechaLectura"  TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeCorrecionPrograma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MensajeCorrecionPrograma_solicitudId_idx" ON "MensajeCorrecionPrograma"("solicitudId");
CREATE INDEX "MensajeCorrecionPrograma_programaId_idx"  ON "MensajeCorrecionPrograma"("programaId");

-- AddForeignKey
ALTER TABLE "MensajeCorrecionPrograma" ADD CONSTRAINT "MensajeCorrecionPrograma_solicitudId_fkey"
    FOREIGN KEY ("solicitudId") REFERENCES "SolicitudAprobacionPrograma"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MensajeCorrecionPrograma" ADD CONSTRAINT "MensajeCorrecionPrograma_programaId_fkey"
    FOREIGN KEY ("programaId") REFERENCES "ProgramaAsignatura"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MensajeCorrecionPrograma" ADD CONSTRAINT "MensajeCorrecionPrograma_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
