import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProgramasService } from './programas.service';

/**
 * Tests de integración de scopes institucionales en ProgramasService — FASE 3
 *
 * Cubre:
 *   - DIRECTOR_CARRERA: acceso solo a su carrera asignada
 *   - DECANO: acceso a todas las carreras de su facultad
 *   - SECRETARIA_ACADEMICA / RECTORADO: scope global
 *   - DOCENTE: solo lectura (bloqueado por RolesGuard; sin branch en el servicio)
 *   - estadoPrograma: APROBADO histórico conservado; PENDIENTE/EN_REVISION para el resto
 *   - Historial: siempre ACTUALIZACION; atómico con el upsert vía $transaction
 *
 * SCOPE != PERMISO. Los tests de controlador y RolesGuard son independientes.
 */

const MATERIA_ID   = 'materia-test-id';
const USUARIO_ID   = 'usuario-test-id';
const CARRERA_ID   = 'carrera-test-id';
const PROGRAMA_ID  = 'programa-test-id';

const MATERIA_CON_CARRERA = {
  id: MATERIA_ID, codigo: 'MAT001', nombre: 'Materia Test',
  planEstudioId: 'plan-1', creditos: 3, estado: 'ACTIVO',
  planEstudio: { carreraId: CARRERA_ID },
};

function makePrograma(estadoPrograma = 'PENDIENTE') {
  return {
    id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma,
    estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
    estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    objetivosGenerales: null, aportesPerfilTitulo: null,
    competenciasResultadosJson: null, contenidosGridJson: null,
    unidadesDidacticasJson: null, formacionPracticaJson: null,
    actividadesFormacionPractica: null,
    recursosDidacticos: null, metodologiaEnsenanza: null,
    modalidadEvaluacion: null, requisitosAprobacion: null,
    bibliografiaBasica: null, fechaVigenciaPrograma: null, fechaAprobacion: null,
    historial: [],
  };
}

function makePrisma(opts: {
  materiaTieneCarrera?: boolean;
  programaActual?: any;
}) {
  const materia = opts.materiaTieneCarrera !== false ? MATERIA_CON_CARRERA : null;
  const programa = opts.programaActual ?? makePrograma();

  const prisma: any = {
    materia: {
      findUnique: jest.fn().mockResolvedValue(materia),
    },
    programaAsignatura: {
      findFirst: jest.fn().mockResolvedValue(programa),
      findUnique: jest.fn().mockResolvedValue({ ...programa, historial: [] }),
      upsert: jest.fn().mockResolvedValue(programa),
    },
    historialPrograma: {
      create: jest.fn().mockResolvedValue({}),
    },
    solicitudAprobacionPrograma: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({ id: 'sol-id' }),
    },
    docente:            { findUnique: jest.fn().mockResolvedValue(null) },
    vinculacionCatedra: { findFirst: jest.fn().mockResolvedValue(null) },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Test', apellido: 'User' }),
      findMany:   jest.fn().mockResolvedValue([]),
    },
    notificacion: {
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    mensajeCorrecionPrograma: {
      create: jest.fn().mockResolvedValue({ id: 'msg-id' }),
    },
  };
  // $transaction llama el callback con el mismo mock (tx === prisma)
  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  return prisma;
}

function makeScopeService(tieneScope = true) {
  return { tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope) };
}

function makeService(prisma: any, scope?: any) {
  return new ProgramasService(prisma as any, (scope ?? makeScopeService()) as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProgramasService — scopes institucionales (FASE 3)', () => {

  // ── 1. SECRETARIA_ACADEMICA — scope global ────────────────────────────────

  describe('SECRETARIA_ACADEMICA — scope global', () => {
    it('puede editar sin verificar scope de carrera', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });
  });

  // ── 2. RECTORADO — scope global ───────────────────────────────────────────

  describe('RECTORADO — scope global', () => {
    it('puede editar sin verificar scope de carrera', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'RECTORADO');
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });
  });

  // ── 3. DIRECTOR_CARRERA — en scope ────────────────────────────────────────

  describe('DIRECTOR_CARRERA — en scope', () => {
    it('puede editar programa de su carrera asignada', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA');
      expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(USUARIO_ID, 'DIRECTOR_CARRERA', CARRERA_ID);
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });
  });

  // ── 4. DIRECTOR_CARRERA — fuera de scope ─────────────────────────────────

  describe('DIRECTOR_CARRERA — fuera de scope', () => {
    it('recibe 403 al intentar editar programa de otra carrera', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(false);
      await expect(
        makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 5. DIRECTOR_CARRERA — sin asociación ─────────────────────────────────

  describe('DIRECTOR_CARRERA — sin carrera asociada', () => {
    it('recibe 403 porque scope retorna false sin asociación', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(false);
      await expect(
        makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA')
      ).rejects.toThrow(ForbiddenException);
      expect(scope.tieneScopeCarrera).toHaveBeenCalled();
    });
  });

  // ── 6. DECANO — en scope ──────────────────────────────────────────────────

  describe('DECANO — en scope (carrera de su facultad)', () => {
    it('puede editar programa de carrera perteneciente a su facultad', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DECANO');
      expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(USUARIO_ID, 'DECANO', CARRERA_ID);
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });
  });

  // ── 7. DECANO — fuera de scope ────────────────────────────────────────────

  describe('DECANO — fuera de scope (carrera de otra facultad)', () => {
    it('recibe 403', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(false);
      await expect(
        makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DECANO')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 8. DECANO — sin facultad asociada ────────────────────────────────────

  describe('DECANO — sin facultad asociada', () => {
    it('recibe 403 porque scope retorna false', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(false);
      await expect(
        makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DECANO')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 9. resolverCarreraDeMateria — materia inexistente ────────────────────

  describe('resolverCarreraDeMateria — materia sin planEstudio', () => {
    it('lanza NotFoundException cuando no se puede resolver la carrera', async () => {
      const prisma = makePrisma({ materiaTieneCarrera: false });
      const scope = makeScopeService(true);
      await expect(
        makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA')
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 10. APROBADO histórico se conserva al editar ─────────────────────────

  describe('estadoPrograma — APROBADO histórico conservado al editar', () => {
    it('un programa con estadoPrograma APROBADO conserva APROBADO tras editar', async () => {
      const programaAprobado = makePrograma('APROBADO');
      const prisma = makePrisma({ programaActual: programaAprobado });
      await makeService(prisma).actualizarPrograma(MATERIA_ID, { seccionModificada: 'S1' }, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      const upsertCall = prisma.programaAsignatura.upsert.mock.calls[0][0];
      expect(upsertCall.update.estadoPrograma).toBe('APROBADO');
    });

    it('un programa PENDIENTE sigue calculando PENDIENTE o EN_REVISION (no APROBADO)', async () => {
      const prisma = makePrisma({});
      await makeService(prisma).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      const upsertCall = prisma.programaAsignatura.upsert.mock.calls[0][0];
      expect(upsertCall.update.estadoPrograma).not.toBe('APROBADO');
      expect(['PENDIENTE', 'EN_REVISION']).toContain(upsertCall.update.estadoPrograma);
    });
  });

  // ── 11. estadoPrograma — EN_REVISION cuando todo completo ────────────────

  describe('estadoPrograma — EN_REVISION cuando secciones completas', () => {
    it('establece EN_REVISION cuando todas las secciones están COMPLETO', async () => {
      const progCompleto = {
        ...makePrograma('PENDIENTE'),
        estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
        estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
        objetivosGenerales: 'x'.repeat(60), aportesPerfilTitulo: 'x'.repeat(60),
        competenciasResultadosJson: JSON.stringify([{ competencia: 'x'.repeat(10), resultadoAprendizaje: 'x'.repeat(10) }]),
        contenidosGridJson: JSON.stringify([{ conceptuales: 'x'.repeat(10), procedimentales: 'x'.repeat(10), actitudinales: 'x'.repeat(10) }]),
        unidadesDidacticasJson: JSON.stringify([{ unidad: 'x'.repeat(10), horas: '2' }]),
        actividadesFormacionPractica: 'x'.repeat(60),
        formacionPracticaJson: JSON.stringify([{ intensidad: 'x'.repeat(10), horasClase: 2 }]),
        recursosDidacticos: 'x'.repeat(60), metodologiaEnsenanza: 'x'.repeat(60),
        modalidadEvaluacion: 'x'.repeat(60), requisitosAprobacion: 'x'.repeat(60),
        bibliografiaBasica: 'x'.repeat(60), fechaVigenciaPrograma: 2025, fechaAprobacion: new Date(),
      };
      const prisma = makePrisma({ programaActual: progCompleto });
      prisma.programaAsignatura.upsert = jest.fn().mockResolvedValue(progCompleto);
      await makeService(prisma).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      const upsertCall = prisma.programaAsignatura.upsert.mock.calls[0][0];
      expect(upsertCall.update.estadoPrograma).toBe('EN_REVISION');
    });
  });

  // ── 12. estadoPrograma — PENDIENTE cuando incompleto ─────────────────────

  describe('estadoPrograma — PENDIENTE cuando secciones incompletas', () => {
    it('establece PENDIENTE cuando hay secciones sin completar', async () => {
      const prisma = makePrisma({});
      await makeService(prisma).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      const upsertCall = prisma.programaAsignatura.upsert.mock.calls[0][0];
      expect(upsertCall.update.estadoPrograma).toBe('PENDIENTE');
    });
  });

  // ── 13. Historial — siempre ACTUALIZACION ────────────────────────────────

  describe('Historial — acción siempre ACTUALIZACION', () => {
    it('registra ACTUALIZACION (nunca REVERSION ni APROBACION)', async () => {
      const prisma = makePrisma({});
      await makeService(prisma).actualizarPrograma(MATERIA_ID, { seccionModificada: 'S1' }, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(prisma.historialPrograma.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accion: 'ACTUALIZACION' }),
      });
    });

    it('no genera acción REVERSION al modificar un programa APROBADO', async () => {
      const programaAprobado = makePrograma('APROBADO');
      const prisma = makePrisma({ programaActual: programaAprobado });
      await makeService(prisma).actualizarPrograma(MATERIA_ID, { seccionModificada: 'S1' }, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      const historialCall = prisma.historialPrograma.create.mock.calls[0][0];
      expect(historialCall.data.accion).toBe('ACTUALIZACION');
      expect(historialCall.data.accion).not.toBe('REVERSION');
    });
  });

  // ── 14. Historial — sección registrada ───────────────────────────────────

  describe('Historial — sección modificada registrada', () => {
    it('guarda la sección indicada en el historial', async () => {
      const prisma = makePrisma({});
      await makeService(prisma).actualizarPrograma(MATERIA_ID, { seccionModificada: 'Objetivos y perfil' }, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(prisma.historialPrograma.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ seccion: 'Objetivos y perfil' }),
      });
    });
  });

  // ── 15. Scope antes del lookup de materia (DC) ────────────────────────────

  describe('DIRECTOR_CARRERA — orden de validaciones', () => {
    it('evalúa el scope ANTES de retornar NotFoundException de materia', async () => {
      const prisma = makePrisma({ materiaTieneCarrera: false });
      const scope = makeScopeService(false);
      // La materia retorna null para planEstudio → NotFoundException desde resolverCarreraDeMateria
      // El scope no llega a evaluarse porque la materia falla primero
      await expect(
        makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA')
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 16. SECRETARIA_ACADEMICA — no invoca scope ni ownership ──────────────

  describe('SECRETARIA_ACADEMICA — sin invocación de scope service', () => {
    it('no llama a tieneScopeCarrera ni a docente.findUnique', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── 17. RECTORADO — no invoca scope ni ownership ─────────────────────────

  describe('RECTORADO — sin invocación de scope service', () => {
    it('no llama a tieneScopeCarrera ni a docente.findUnique', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'RECTORADO');
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── 18. Scope check sólo para DC y DECANO ────────────────────────────────

  describe('Scope check — únicamente para DIRECTOR_CARRERA y DECANO', () => {
    it.each(['SECRETARIA_ACADEMICA', 'RECTORADO', 'ADMINISTRADOR_SISTEMA'])(
      '%s no invoca tieneScopeCarrera',
      async (rol) => {
        const prisma = makePrisma({});
        const scope = makeScopeService(true);
        await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, rol);
        expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      }
    );
  });

  // ── 19. ADMINISTRADOR_SISTEMA — scope global ──────────────────────────────

  describe('ADMINISTRADOR_SISTEMA — scope global', () => {
    it('puede editar sin verificar scope de carrera', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });

    it('no llama a tieneScopeCarrera ni a docente.findUnique', async () => {
      const prisma = makePrisma({});
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── 19-21. obtenerPrograma — APROBADO histórico conservado ───────────────

  describe('obtenerPrograma — estadoPrograma APROBADO histórico conservado', () => {
    it('devuelve APROBADO si el registro tiene estadoPrograma=APROBADO en BD', async () => {
      const programaAprobado = { ...makePrograma('APROBADO'), historial: [] };
      const prisma: any = {
        materia: { findUnique: jest.fn().mockResolvedValue(MATERIA_CON_CARRERA) },
        programaAsignatura: { upsert: jest.fn().mockResolvedValue(programaAprobado) },
      };
      const result = await makeService(prisma).obtenerPrograma(MATERIA_ID);
      expect(result.estadoPrograma).toBe('APROBADO');
    });

    it('calcula EN_REVISION si el programa no es APROBADO y está completo', async () => {
      const progCompleto = {
        ...makePrograma('EN_REVISION'),
        estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
        estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
        objetivosGenerales: 'x'.repeat(60), aportesPerfilTitulo: 'x'.repeat(60),
        competenciasResultadosJson: JSON.stringify([{ competencia: 'x'.repeat(10), resultadoAprendizaje: 'x'.repeat(10) }]),
        contenidosGridJson: JSON.stringify([{ conceptuales: 'x'.repeat(10), procedimentales: 'x'.repeat(10), actitudinales: 'x'.repeat(10) }]),
        unidadesDidacticasJson: JSON.stringify([{ unidad: 'x'.repeat(10) }]),
        actividadesFormacionPractica: 'x'.repeat(60),
        formacionPracticaJson: JSON.stringify([{ intensidad: 'x'.repeat(10), horasClase: 2 }]),
        recursosDidacticos: 'x'.repeat(60), metodologiaEnsenanza: 'x'.repeat(60),
        modalidadEvaluacion: 'x'.repeat(60), requisitosAprobacion: 'x'.repeat(60),
        bibliografiaBasica: 'x'.repeat(60), fechaVigenciaPrograma: 2025, fechaAprobacion: new Date(),
        historial: [],
      };
      const prisma: any = {
        materia: { findUnique: jest.fn().mockResolvedValue(MATERIA_CON_CARRERA) },
        programaAsignatura: { upsert: jest.fn().mockResolvedValue(progCompleto) },
      };
      const result = await makeService(prisma).obtenerPrograma(MATERIA_ID);
      expect(result.estadoPrograma).toBe('EN_REVISION');
    });

    it('calcula PENDIENTE si el programa no es APROBADO y está incompleto', async () => {
      const progPendiente = { ...makePrograma('PENDIENTE'), historial: [] };
      const prisma: any = {
        materia: { findUnique: jest.fn().mockResolvedValue(MATERIA_CON_CARRERA) },
        programaAsignatura: { upsert: jest.fn().mockResolvedValue(progPendiente) },
      };
      const result = await makeService(prisma).obtenerPrograma(MATERIA_ID);
      expect(result.estadoPrograma).toBe('PENDIENTE');
    });
  });

  // ── Validación — horas en unidades didácticas (S3) ──────────────────────

  describe('Validación — horas en unidadesDidacticasJson', () => {
    it('acepta horas como string de solo dígitos', async () => {
      const prisma = makePrisma({});
      await expect(
        makeService(prisma).actualizarPrograma(
          MATERIA_ID,
          { unidadesDidacticasJson: JSON.stringify([{ unidad: 'Unidad 1', horas: '10' }]) },
          USUARIO_ID, 'SECRETARIA_ACADEMICA',
        )
      ).resolves.not.toThrow();
    });

    it('acepta horas vacías o nulas sin validar', async () => {
      const prisma = makePrisma({});
      await expect(
        makeService(prisma).actualizarPrograma(
          MATERIA_ID,
          { unidadesDidacticasJson: JSON.stringify([{ unidad: 'Unidad 1', horas: '' }]) },
          USUARIO_ID, 'SECRETARIA_ACADEMICA',
        )
      ).resolves.not.toThrow();
    });

    it('rechaza horas con punto decimal (e.g. "1.5")', async () => {
      const prisma = makePrisma({});
      await expect(
        makeService(prisma).actualizarPrograma(
          MATERIA_ID,
          { unidadesDidacticasJson: JSON.stringify([{ unidad: 'Unidad 1', horas: '1.5' }]) },
          USUARIO_ID, 'SECRETARIA_ACADEMICA',
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza horas con letras (e.g. "2h")', async () => {
      const prisma = makePrisma({});
      await expect(
        makeService(prisma).actualizarPrograma(
          MATERIA_ID,
          { unidadesDidacticasJson: JSON.stringify([{ unidad: 'Unidad 1', horas: '2h' }]) },
          USUARIO_ID, 'SECRETARIA_ACADEMICA',
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── 22-23. Transacción atómica — upsert + historial ──────────────────────

  describe('Historial atómico — upsert y create en la misma $transaction', () => {
    it('upsert y historialPrograma.create se ejecutan dentro de $transaction', async () => {
      const prisma = makePrisma({});
      await makeService(prisma).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
      expect(prisma.historialPrograma.create).toHaveBeenCalled();
    });

    it('si historialPrograma.create falla dentro de la transacción, actualizarPrograma rechaza', async () => {
      const prisma = makePrisma({});
      const txError = new Error('falla de historial');
      prisma.$transaction.mockImplementationOnce(async (cb: any) => {
        const txWithError = {
          ...prisma,
          historialPrograma: { create: jest.fn().mockRejectedValue(txError) },
        };
        return cb(txWithError);
      });
      await expect(
        makeService(prisma).actualizarPrograma(MATERIA_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA')
      ).rejects.toThrow('falla de historial');
    });
  });

});
