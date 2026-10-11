-- CreateTable: circuito de aprobación de Programas de Asignatura
CREATE TABLE "SolicitudAprobacionPrograma" (
    "id" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_APROBACION',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaResolucion" TIMESTAMP(3),
    "aprobadorId" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "SolicitudAprobacionPrograma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudAprobacionPrograma_programaId_estado_idx" ON "SolicitudAprobacionPrograma"("programaId", "estado");

-- AddForeignKey
ALTER TABLE "SolicitudAprobacionPrograma" ADD CONSTRAINT "SolicitudAprobacionPrograma_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaAsignatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudAprobacionPrograma" ADD CONSTRAINT "SolicitudAprobacionPrograma_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
