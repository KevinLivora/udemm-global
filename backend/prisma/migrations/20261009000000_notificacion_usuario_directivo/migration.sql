-- C13: Extender Notificacion para soportar notificaciones a directivos
-- docenteId se vuelve nullable; usuarioId permite vincular a cualquier Usuario.

ALTER TABLE "Notificacion" ALTER COLUMN "docenteId" DROP NOT NULL;

ALTER TABLE "Notificacion" ADD COLUMN "usuarioId" TEXT;

ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Notificacion_usuarioId_idx" ON "Notificacion"("usuarioId");
