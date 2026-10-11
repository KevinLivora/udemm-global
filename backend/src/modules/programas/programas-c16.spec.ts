import { ProgramasService, calcEstadoFuncional } from './programas.service';

/**
 * Tests C16 — Corrección de inconsistencias entre completitud y estado funcional.
 *
 * Causa raíz: calcEstadoFuncional ignoraba todasCompletas — devolvía INCOMPLETO
 * para programas históricos al 100% sin solicitud activa ni estadoPrograma=APROBADO.
 *
 * Escenarios cubiertos (12):
 *
 *   1.  Programa 17% sin solicitud → INCOMPLETO
 *   2.  Programa 100% sin solicitud y sin aprobación → genera solicitud en actualizarPrograma
 *   3.  Programa 100% con solicitud PENDIENTE_APROBACION → EN_REVISION
 *   4.  Programa 100% con solicitud CORRECCIONES_SOLICITADAS → EN_CORRECCION
 *   5.  Programa 100% con estadoPrograma APROBADO → APROBADO
 *   6.  Programa histórico 100% sin solicitud (estadoPrograma PENDIENTE) → EN_REVISION (no INCOMPLETO)
 *   7.  No se duplican solicitudes si ya existe una PENDIENTE_APROBACION
 *   8.  No se invalida la aprobación vigente en cambio administrativo
 *   9.  El historial de aprobación se conserva en actualizarPrograma
 *   10. calcEstadoFuncional produce el mismo resultado con cualquier estadoPrograma≠APROBADO al 100%
 *   11. calcEstadoFuncional no devuelve INCOMPLETO cuando todasCompletas=true (cualquier estadoPrograma≠APROBADO)
 *   12. listarProgramasParaRegularizacion no modifica datos (solo lectura)
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const U_ID         = 'usuario-id';
const PROGRAMA_ID  = 'prog-c16-id';
const MATERIA_ID   = 'materia-c16-id';
const CARRERA_ID   = 'carrera-c16-id';
const SOLICITUD_ID = 'sol-c16-id';
const TEXTO_LARGO  = 'x'.repeat(55);

function makeProgramaCompleto(estadoPrograma = 'EN_REVISION') {
  return {
    id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma,
    estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
    estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
    objetivosGenerales:           TEXTO_LARGO,
    aportesPerfilTitulo:          TEXTO_LARGO,
    competenciasResultadosJson:   JSON.stringify([{ competencia: 'c', resultadoAprendizaje: 'r' }]),
    contenidosGridJson:           JSON.stringify([{ conceptuales: 'c', procedimentales: 'p', actitudinales: 'a' }]),
    unidadesDidacticasJson:       JSON.stringify([{ unidad: 'u1' }]),
    actividadesFormacionPractica: TEXTO_LARGO,
    formacionPracticaJson:        JSON.stringify([{ intensidad: 'alta', horasClase: 4 }]),
    recursosDidacticos:           TEXTO_LARGO,
    metodologiaEnsenanza:         TEXTO_LARGO,
    modalidadEvaluacion:          TEXTO_LARGO,
    requisitosAprobacion:         TEXTO_LARGO,
    bibliografiaBasica:           TEXTO_LARGO,
    fechaVigenciaPrograma:        new Date('2025-01-01'),
    fechaAprobacion:              new Date('2024-12-01'),
    historial: [], solicitudes: [],
  };
}

function makeProgramaIncompleto() {
  return {
    id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma: 'PENDIENTE',
    estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
    estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    objetivosGenerales: null, aportesPerfilTitulo: null,
    competenciasResultadosJson: null, contenidosGridJson: null,
    unidadesDidacticasJson: null, formacionPracticaJson: null,
    actividadesFormacionPractica: null, recursosDidacticos: null,
    metodologiaEnsenanza: null, modalidadEvaluacion: null,
    requisitosAprobacion: null, bibliografiaBasica: null,
    fechaVigenciaPrograma: null, fechaAprobacion: null,
    historial: [], solicitudes: [],
  };
}

function makeSolicitud(estado: string) {
  return {
    id: SOLICITUD_ID, programaId: PROGRAMA_ID, estado,
    fechaCreacion: new Date(), fechaResolucion: null,
    observaciones: null, aprobadorId: null, aprobador: null, mensajes: [],
    programa: {
      id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma: 'EN_REVISION',
      materia: {
        id: MATERIA_ID, nombre: 'Investigación Operativa I',
        planEstudio: {
          carreraId: CARRERA_ID, nombre: 'Plan 2006',
          carrera: {
            id: CARRERA_ID, nombre: 'Ing. Industrial',
            facultad: { nombre: 'Fac. Ingeniería' },
          },
        },
      },
    },
  };
}

function makePrisma(opts: {
  programaActual?: any;
  solicitudActual?: any;
  programaPost?: any;    // devuelto por findUnique tras actualizarPrograma
} = {}) {
  const prog     = opts.programaActual ?? makeProgramaCompleto();
  const sol      = opts.solicitudActual ?? null;
  const progPost = opts.programaPost   ?? prog;

  const prisma: any = {
    materia: {
      findUnique: jest.fn().mockResolvedValue({
        id: MATERIA_ID, nombre: 'Investigación Operativa I',
        planEstudio: {
          carreraId: CARRERA_ID, nombre: 'Plan 2006',
          carrera: { id: CARRERA_ID, nombre: 'Ing. Industrial', facultad: { nombre: 'Fac. Ingeniería' } },
        },
      }),
    },
    programaAsignatura: {
      findFirst:  jest.fn().mockResolvedValue(prog),
      findUnique: jest.fn().mockImplementation(({ include }: any) => {
        if (include?.solicitudes) {
          return Promise.resolve({ ...progPost, historial: [], solicitudes: sol ? [sol] : [] });
        }
        return Promise.resolve(progPost);
      }),
      upsert: jest.fn().mockResolvedValue({ ...prog, historial: [], solicitudes: sol ? [sol] : [] }),
      update: jest.fn().mockResolvedValue({ ...prog, estadoPrograma: 'EN_REVISION' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    solicitudAprobacionPrograma: {
      findFirst:  jest.fn().mockResolvedValue(sol),
      findMany:   jest.fn().mockResolvedValue(sol ? [sol] : []),
      create:     jest.fn().mockResolvedValue({ id: 'nueva-sol-id', estado: 'PENDIENTE_APROBACION' }),
      update:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    historialPrograma: {
      create:  jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    vinculacionCatedra: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany:  jest.fn().mockResolvedValue([]),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Dir', apellido: 'Test' }),
      findMany:   jest.fn().mockResolvedValue([]),
    },
    notificacion: {
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    mensajeCorrecionPrograma: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    docente: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  return prisma;
}

function makeScopeService(tieneScope = true) {
  return {
    tieneScopeCarrera:  jest.fn().mockResolvedValue(tieneScope),
    getCarrerasEnScope: jest.fn().mockResolvedValue(null),
  };
}

function makeService(prisma: any, scope?: any) {
  return new ProgramasService(prisma as any, (scope ?? makeScopeService()) as any);
}

// ── DTO mínimo completo ────────────────────────────────────────────────────────
const DTO_COMPLETO = {
  seccionModificada: 'general',
  objetivosGenerales:         'x'.repeat(55),
  aportesPerfilTitulo:        'x'.repeat(55),
  competenciasResultadosJson: JSON.stringify([{ competencia: 'c', resultadoAprendizaje: 'r' }]),
  contenidosGridJson:         JSON.stringify([{ conceptuales: 'c', procedimentales: 'p', actitudinales: 'a' }]),
  unidadesDidacticasJson:     JSON.stringify([{ unidad: 'u1' }]),
  actividadesFormacionPractica: 'x'.repeat(55),
  formacionPracticaJson:      JSON.stringify([{ intensidad: 'alta', horasClase: 4 }]),
  recursosDidacticos:         'x'.repeat(55),
  metodologiaEnsenanza:       'x'.repeat(55),
  modalidadEvaluacion:        'x'.repeat(55),
  requisitosAprobacion:       'x'.repeat(55),
  bibliografiaBasica:         'x'.repeat(55),
  fechaVigenciaPrograma:      2025,
  fechaAprobacion:            '2024-12-01',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests 1–12
// ─────────────────────────────────────────────────────────────────────────────

describe('C16 — Consistencia entre completitud y estado funcional', () => {

  // Tests 1–5: función pura calcEstadoFuncional
  describe('calcEstadoFuncional — estados básicos', () => {

    test('1. Programa 17% sin solicitud → INCOMPLETO', () => {
      expect(calcEstadoFuncional('PENDIENTE', false, null)).toBe('INCOMPLETO');
    });

    test('3. Programa 100% con solicitud PENDIENTE_APROBACION → EN_REVISION', () => {
      expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'PENDIENTE_APROBACION' })).toBe('EN_REVISION');
    });

    test('4. Programa 100% con solicitud CORRECCIONES_SOLICITADAS → EN_CORRECCION', () => {
      expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'CORRECCIONES_SOLICITADAS' })).toBe('EN_CORRECCION');
    });

    test('5. Programa 100% con estadoPrograma APROBADO → APROBADO', () => {
      expect(calcEstadoFuncional('APROBADO', true, null)).toBe('APROBADO');
    });

    test('6. Programa histórico 100% sin solicitud (estadoPrograma PENDIENTE) → EN_REVISION (no INCOMPLETO)', () => {
      // Este era el bug: antes devolvía INCOMPLETO. Ahora usa todasCompletas.
      expect(calcEstadoFuncional('PENDIENTE', true, null)).toBe('EN_REVISION');
      expect(calcEstadoFuncional('EN_REVISION', true, null)).toBe('EN_REVISION');
      expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'INVALIDADA' })).toBe('EN_REVISION');
    });

    test('10. calcEstadoFuncional produce EN_REVISION con cualquier estadoPrograma≠APROBADO al 100%', () => {
      expect(calcEstadoFuncional('PENDIENTE', true, null)).toBe('EN_REVISION');
      expect(calcEstadoFuncional('EN_REVISION', true, null)).toBe('EN_REVISION');
      expect(calcEstadoFuncional('COMPLETO', true, null)).toBe('EN_REVISION');
    });

    test('11. calcEstadoFuncional no devuelve INCOMPLETO cuando todasCompletas=true', () => {
      const estadosIncompletos = ['PENDIENTE', 'EN_REVISION', 'COMPLETO', 'OTRO_ESTADO'];
      for (const e of estadosIncompletos) {
        const resultado = calcEstadoFuncional(e, true, null);
        expect(resultado).not.toBe('INCOMPLETO');
      }
    });

  });

  // Test 2: actualizarPrograma genera solicitud al alcanzar 100%
  describe('actualizarPrograma — generación automática de solicitud', () => {

    test('2. Programa 100% sin solicitud activa → genera solicitud automáticamente', async () => {
      const progCompleto = makeProgramaCompleto();
      const prisma = makePrisma({ programaActual: progCompleto, solicitudActual: null });
      // Simular que después de la actualización el programa sigue completo
      prisma.programaAsignatura.findUnique = jest.fn().mockImplementation(({ include }: any) => {
        if (include?.solicitudes) {
          return Promise.resolve({ ...progCompleto, historial: [], solicitudes: [] });
        }
        return Promise.resolve(progCompleto);
      });
      const svc = makeService(prisma);

      await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'SECRETARIA_ACADEMICA');

      expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalledTimes(1);
    });

    test('7. No se duplican solicitudes si ya existe una PENDIENTE_APROBACION', async () => {
      const solPendiente = makeSolicitud('PENDIENTE_APROBACION');
      const progCompleto = makeProgramaCompleto();
      const prisma = makePrisma({ programaActual: progCompleto, solicitudActual: solPendiente });
      const svc = makeService(prisma);

      await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'SECRETARIA_ACADEMICA');

      expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
    });

    test('8. Cambio administrativo en programa APROBADO no invalida la aprobación', async () => {
      const progAprobado = makeProgramaCompleto('APROBADO');
      const prisma = makePrisma({ programaActual: progAprobado, solicitudActual: null });
      prisma.programaAsignatura.findUnique = jest.fn().mockImplementation(({ include }: any) => {
        if (include?.solicitudes) {
          return Promise.resolve({ ...progAprobado, historial: [], solicitudes: [] });
        }
        return Promise.resolve(progAprobado);
      });
      const svc = makeService(prisma);

      const result = await svc.actualizarPrograma(
        MATERIA_ID,
        { seccionModificada: 'seccion-admin' },
        U_ID,
        'SECRETARIA_ACADEMICA',
      );

      // El estado APROBADO se conserva
      expect(result.estadoFuncional).toBe('APROBADO');
      // No se crea nueva solicitud por cambio administrativo
      expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
    });

    test('9. El historial de aprobación se conserva en actualizarPrograma', async () => {
      const progCompleto = makeProgramaCompleto();
      const prisma = makePrisma({ programaActual: progCompleto });
      prisma.programaAsignatura.findUnique = jest.fn().mockImplementation(({ include }: any) => {
        if (include?.solicitudes) {
          return Promise.resolve({ ...progCompleto, historial: [], solicitudes: [] });
        }
        return Promise.resolve(progCompleto);
      });
      const svc = makeService(prisma);

      await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'SECRETARIA_ACADEMICA');

      expect(prisma.historialPrograma.create).toHaveBeenCalledTimes(1);
    });

  });

  // Test 12: regularización es solo lectura
  describe('listarProgramasParaRegularizacion — solo lectura', () => {

    test('12. El endpoint de regularización no modifica datos durante el diagnóstico', async () => {
      const prisma = makePrisma();
      prisma.programaAsignatura.findMany = jest.fn().mockResolvedValue([
        {
          id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma: 'PENDIENTE',
          materia: {
            nombre: 'Investigación Operativa I',
            planEstudio: {
              nombre: 'Plan 2006',
              carrera: { nombre: 'Ing. Industrial', facultad: { nombre: 'Fac. Ingeniería' } },
            },
          },
          solicitudes: [],
          fechaActualizacion: new Date(),
        },
      ]);
      const svc = makeService(prisma);

      const resultado = await svc.listarProgramasParaRegularizacion(U_ID, 'SECRETARIA_ACADEMICA');

      // Solo lectura: nunca create, update ni updateMany sobre programas/solicitudes
      expect(prisma.programaAsignatura.update).not.toHaveBeenCalled();
      expect(prisma.programaAsignatura.create).toBeUndefined();
      expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
      expect(prisma.solicitudAprobacionPrograma.update).not.toHaveBeenCalled();
      // Devuelve candidatos correctamente
      expect(resultado.cantidad).toBe(1);
      expect(resultado.programas[0].materiaNombre).toBe('Investigación Operativa I');
    });

  });

});
