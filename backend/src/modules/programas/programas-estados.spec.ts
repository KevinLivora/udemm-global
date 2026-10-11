import { ForbiddenException } from '@nestjs/common';
import { ProgramasService, calcEstadoFuncional } from './programas.service';

/**
 * Tests de estados funcionales e historial compartido — C12/C13/C16
 *
 * Escenarios cubiertos (25):
 *
 * calcEstadoFuncional (función pura) — 9 tests
 *   1.  Sin solicitud, secciones incompletas → INCOMPLETO
 *   2.  Sin solicitud, todas completas → EN_REVISION (C16: programa histórico 100% no es INCOMPLETO)
 *   3.  Sin solicitud, estadoPrograma=APROBADO → APROBADO
 *   4.  Solicitud PENDIENTE_APROBACION → EN_REVISION
 *   5.  Solicitud CORRECCIONES_SOLICITADAS → EN_CORRECCION
 *   6.  CORRECCIONES_SOLICITADAS tiene prioridad sobre secciones completas
 *   7.  PENDIENTE_APROBACION tiene prioridad sobre estadoPrograma=APROBADO
 *   8.  Solicitud INVALIDADA, secciones completas → EN_REVISION (C16: 100% pendiente regularización)
 *   9.  Solicitud APROBADO (solicitud resuelta), estadoPrograma≠APROBADO → EN_REVISION (C16)
 *
 * obtenerPrograma retorna estadoFuncional — 3 tests
 *   10. Sin solicitud, programa incompleto → INCOMPLETO
 *   11. Con solicitud PENDIENTE_APROBACION → EN_REVISION
 *   12. estadoPrograma=APROBADO sin solicitud activa → APROBADO
 *
 * actualizarPrograma retorna estadoFuncional — 3 tests
 *   13. Actualización a 100% crea solicitud → EN_REVISION
 *   14. Actualización que baja del 100% → INCOMPLETO
 *   15. Programa APROBADO, cambio administrativo → APROBADO
 *
 * obtenerHistorialPrograma — scope de directivos — 6 tests
 *   16. SECRETARIA_ACADEMICA (scope global) → retorna historial
 *   17. RECTORADO (scope global) → retorna historial
 *   18. DIRECTOR_CARRERA con scope correcto → retorna historial
 *   19. DIRECTOR_CARRERA fuera de scope → ForbiddenException
 *   20. DECANO con scope correcto → retorna historial
 *   21. DECANO fuera de scope → ForbiddenException
 *
 * obtenerHistorialPrograma — acceso DOCENTE — 2 tests
 *   22. DOCENTE con vinculación APROBADA → retorna historial
 *   23. DOCENTE sin vinculación APROBADA → ForbiddenException
 *
 * obtenerHistorialPrograma — datos retornados — 2 tests
 *   24. Retorna historial + solicitudes (con mensajes anidados)
 *   25. Materia sin programa → retorna { historial: [], solicitudes: [] }
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const U_ID         = 'usuario-id';
const PROGRAMA_ID  = 'programa-id';
const MATERIA_ID   = 'materia-id';
const CARRERA_ID   = 'carrera-id';
const DOCENTE_ID   = 'docente-id';
const SOLICITUD_ID = 'solicitud-id';
const TEXTO_LARGO  = 'x'.repeat(55);

function makeProgramaCompleto(estadoPrograma = 'EN_REVISION') {
  return {
    id: PROGRAMA_ID,
    materiaId: MATERIA_ID,
    estadoPrograma,
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
    historial:                    [],
    solicitudes:                  [],
  };
}

function makeProgramaIncompleto() {
  return {
    id: PROGRAMA_ID,
    materiaId: MATERIA_ID,
    estadoPrograma: 'PENDIENTE',
    estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
    estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    objetivosGenerales: null, aportesPerfilTitulo: null,
    competenciasResultadosJson: null, contenidosGridJson: null,
    unidadesDidacticasJson: null, formacionPracticaJson: null,
    actividadesFormacionPractica: null, recursosDidacticos: null,
    metodologiaEnsenanza: null, modalidadEvaluacion: null,
    requisitosAprobacion: null, bibliografiaBasica: null,
    fechaVigenciaPrograma: null, fechaAprobacion: null,
    historial: [],
    solicitudes: [],
  };
}

function makeSolicitud(estado: string, extra: Record<string, unknown> = {}) {
  return {
    id: SOLICITUD_ID,
    programaId: PROGRAMA_ID,
    estado,
    fechaCreacion: new Date(),
    fechaResolucion: null,
    observaciones: null,
    aprobadorId: null,
    aprobador: null,
    mensajes: [],
    programa: {
      id: PROGRAMA_ID,
      materiaId: MATERIA_ID,
      estadoPrograma: 'EN_REVISION',
      materia: {
        id: MATERIA_ID,
        nombre: 'Materia Test',
        planEstudio: {
          carreraId: CARRERA_ID,
          carrera: { nombre: 'Carrera Test', facultad: { nombre: 'Facultad Test' } },
        },
      },
    },
    ...extra,
  };
}

function makePrisma(opts: {
  programaActual?: any;
  solicitudActual?: any;
  programaConHistorial?: any;
  docentePerfil?: any;
  vinculacion?: any;
} = {}) {
  const prog = opts.programaActual ?? makeProgramaCompleto();
  const solActual = opts.solicitudActual ?? null;

  const prisma: any = {
    programaAsignatura: {
      findFirst:  jest.fn().mockResolvedValue(prog),
      findUnique: jest.fn().mockImplementation(({ include }: any) => {
        if (include?.solicitudes) {
          const solicitudes = solActual ? [solActual] : [];
          return Promise.resolve({ ...prog, historial: [], solicitudes });
        }
        if (include?.historial && include?.solicitudes === undefined) {
          // historialPrograma query from obtenerHistorialPrograma
          const histProg = opts.programaConHistorial ?? null;
          return Promise.resolve(histProg);
        }
        return Promise.resolve({ ...prog, historial: [] });
      }),
      upsert: jest.fn().mockImplementation(() => {
        const solicitudes = solActual ? [solActual] : [];
        return Promise.resolve({ ...prog, historial: [], solicitudes });
      }),
      update: jest.fn().mockResolvedValue(prog),
    },
    solicitudAprobacionPrograma: {
      findFirst:  jest.fn().mockResolvedValue(solActual),
      findUnique: jest.fn().mockResolvedValue(solActual),
      findMany:   jest.fn().mockResolvedValue(solActual ? [solActual] : []),
      create:     jest.fn().mockResolvedValue({ id: 'nueva-solicitud' }),
      update:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    historialPrograma: {
      create: jest.fn().mockResolvedValue({}),
    },
    vinculacionCatedra: {
      findFirst: jest.fn().mockResolvedValue(opts.vinculacion ?? null),
      findMany:  jest.fn().mockResolvedValue([]),
    },
    docente: {
      findUnique: jest.fn().mockResolvedValue(opts.docentePerfil ?? null),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Test', apellido: 'User' }),
      findMany:  jest.fn().mockResolvedValue([]), // sin directivos por defecto
    },
    materia: {
      findUnique: jest.fn().mockResolvedValue({
        id: MATERIA_ID,
        nombre: 'Materia Test',
        planEstudio: {
          carreraId: CARRERA_ID,
          nombre: 'Plan Test',
          carrera: {
            id: CARRERA_ID,
            nombre: 'Carrera Test',
            facultadId: 'facultad-id',
            facultad: { id: 'facultad-id', nombre: 'Facultad Test' },
          },
        },
      }),
    },
    mensajeCorrecionPrograma: {
      create: jest.fn().mockResolvedValue({ id: 'msg-id' }),
      count:  jest.fn().mockResolvedValue(0),
    },
    notificacion: {
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  return prisma;
}

function makeScopeService(tieneScope = true) {
  return {
    tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope),
    getCarrerasEnScope: jest.fn().mockResolvedValue(null),
  };
}

function makeService(prisma: any, scope?: any) {
  return new ProgramasService(prisma as any, (scope ?? makeScopeService()) as any);
}

// ── 1–9: calcEstadoFuncional (función pura) ───────────────────────────────────

describe('calcEstadoFuncional — función pura', () => {
  test('1. sin solicitud, incompleto → INCOMPLETO', () => {
    expect(calcEstadoFuncional('PENDIENTE', false, null)).toBe('INCOMPLETO');
  });

  test('2. sin solicitud, todas completas → EN_REVISION (C16: programa histórico 100% no es INCOMPLETO)', () => {
    expect(calcEstadoFuncional('EN_REVISION', true, null)).toBe('EN_REVISION');
  });

  test('3. sin solicitud, estadoPrograma=APROBADO → APROBADO', () => {
    expect(calcEstadoFuncional('APROBADO', true, null)).toBe('APROBADO');
  });

  test('4. solicitud PENDIENTE_APROBACION → EN_REVISION', () => {
    expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'PENDIENTE_APROBACION' })).toBe('EN_REVISION');
  });

  test('5. solicitud CORRECCIONES_SOLICITADAS → EN_CORRECCION', () => {
    expect(calcEstadoFuncional('EN_REVISION', false, { estado: 'CORRECCIONES_SOLICITADAS' })).toBe('EN_CORRECCION');
  });

  test('6. CORRECCIONES_SOLICITADAS tiene prioridad aunque todas estén completas', () => {
    expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'CORRECCIONES_SOLICITADAS' })).toBe('EN_CORRECCION');
  });

  test('7. PENDIENTE_APROBACION tiene prioridad sobre estadoPrograma=APROBADO', () => {
    expect(calcEstadoFuncional('APROBADO', true, { estado: 'PENDIENTE_APROBACION' })).toBe('EN_REVISION');
  });

  test('8. solicitud INVALIDADA, secciones completas → EN_REVISION (C16: 100% no es INCOMPLETO)', () => {
    // Solicitud invalidada + 100% completo → pendiente de regularización → EN_REVISION
    expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'INVALIDADA' })).toBe('EN_REVISION');
  });

  test('9. solicitud resuelta como APROBADO, estadoPrograma EN_REVISION → EN_REVISION (C16)', () => {
    // Sin solicitud activa y estadoPrograma != APROBADO y 100% completo → EN_REVISION.
    // Indica inconsistencia de datos; requiere regularización.
    expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'APROBADO' })).toBe('EN_REVISION');
  });
});

// ── 10–12: obtenerPrograma retorna estadoFuncional ────────────────────────────

describe('obtenerPrograma — incluye estadoFuncional', () => {
  test('10. sin solicitud, programa incompleto → estadoFuncional=INCOMPLETO', async () => {
    const prisma = makePrisma({ programaActual: makeProgramaIncompleto(), solicitudActual: null });
    const svc = makeService(prisma);

    const result = await svc.obtenerPrograma(MATERIA_ID);

    expect(result.estadoFuncional).toBe('INCOMPLETO');
  });

  test('11. con solicitud PENDIENTE_APROBACION → estadoFuncional=EN_REVISION', async () => {
    const prisma = makePrisma({
      programaActual: makeProgramaCompleto(),
      solicitudActual: makeSolicitud('PENDIENTE_APROBACION'),
    });
    // upsert en obtenerPrograma devuelve solicitudes embebidas
    prisma.programaAsignatura.upsert = jest.fn().mockResolvedValue({
      ...makeProgramaCompleto(),
      solicitudes: [makeSolicitud('PENDIENTE_APROBACION')],
      historial: [],
    });
    const svc = makeService(prisma);

    const result = await svc.obtenerPrograma(MATERIA_ID);

    expect(result.estadoFuncional).toBe('EN_REVISION');
  });

  test('12. estadoPrograma=APROBADO sin solicitud activa → estadoFuncional=APROBADO', async () => {
    const progAprobado = { ...makeProgramaCompleto('APROBADO'), solicitudes: [], historial: [] };
    const prisma = makePrisma({ programaActual: progAprobado, solicitudActual: null });
    prisma.programaAsignatura.upsert = jest.fn().mockResolvedValue(progAprobado);
    const svc = makeService(prisma);

    const result = await svc.obtenerPrograma(MATERIA_ID);

    expect(result.estadoFuncional).toBe('APROBADO');
  });
});

// ── 13–15: actualizarPrograma retorna estadoFuncional ────────────────────────

const DTO_COMPLETO = {
  seccionModificada: 'general',
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
  fechaAprobacion:              '2024-12-01',
  fechaVigenciaPrograma:        '2025-01-01',
};

const DTO_ADMIN = { seccionModificada: 'admin' };

describe('actualizarPrograma — retorna estadoFuncional', () => {
  test('13. actualización a 100% crea solicitud → estadoFuncional=EN_REVISION', async () => {
    const progIncompleto = makeProgramaIncompleto();
    const nuevaSolicitud = makeSolicitud('PENDIENTE_APROBACION');

    const prisma = makePrisma({ programaActual: progIncompleto });
    // findUnique después de la transacción devuelve programa con la solicitud nueva
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...makeProgramaCompleto(),
      solicitudes: [nuevaSolicitud],
      historial: [],
    });
    const svc = makeService(prisma);

    const result = await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO as any, U_ID, 'SECRETARIA_ACADEMICA');

    expect(result.estadoFuncional).toBe('EN_REVISION');
  });

  test('14. actualización que baja avance del 100% → estadoFuncional=INCOMPLETO', async () => {
    const progCompleto = makeProgramaCompleto();
    const prisma = makePrisma({ programaActual: progCompleto });
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...makeProgramaIncompleto(),
      solicitudes: [],
      historial: [],
    });
    const svc = makeService(prisma);

    const result = await svc.actualizarPrograma(MATERIA_ID, { ...DTO_ADMIN, objetivosGenerales: '' } as any, U_ID, 'SECRETARIA_ACADEMICA');

    expect(result.estadoFuncional).toBe('INCOMPLETO');
  });

  test('15. programa APROBADO, cambio administrativo → estadoFuncional=APROBADO', async () => {
    const progAprobado = makeProgramaCompleto('APROBADO');
    const prisma = makePrisma({ programaActual: progAprobado });
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...progAprobado,
      solicitudes: [],
      historial: [],
    });
    const svc = makeService(prisma);

    const result = await svc.actualizarPrograma(MATERIA_ID, DTO_ADMIN as any, U_ID, 'SECRETARIA_ACADEMICA');

    expect(result.estadoFuncional).toBe('APROBADO');
  });
});

// ── 16–21: obtenerHistorialPrograma — scope de directivos ────────────────────

const HISTORIAL_DATA = {
  historial: [{ id: 'h1', accion: 'ACTUALIZACION', descripcion: 'test', fecha: new Date(), usuario: { id: U_ID, nombre: 'Test', apellido: 'U' } }],
  solicitudes: [makeSolicitud('PENDIENTE_APROBACION')],
};

function makePrismaConHistorial() {
  const prog = { ...makeProgramaCompleto(), ...HISTORIAL_DATA };
  const prisma = makePrisma();
  prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue(prog);
  return prisma;
}

describe('obtenerHistorialPrograma — scope de directivos', () => {
  test('16. SECRETARIA_ACADEMICA (scope global) → retorna historial sin validar scope', async () => {
    const prisma = makePrismaConHistorial();
    const scope = makeScopeService();
    const svc = makeService(prisma, scope);

    const result = await svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'SECRETARIA_ACADEMICA');

    expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
    expect(result.historial).toHaveLength(1);
  });

  test('17. RECTORADO (scope global) → retorna historial sin validar scope', async () => {
    const prisma = makePrismaConHistorial();
    const scope = makeScopeService();
    const svc = makeService(prisma, scope);

    const result = await svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'RECTORADO');

    expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
    expect(result.solicitudes).toHaveLength(1);
  });

  test('18. DIRECTOR_CARRERA con scope correcto → retorna historial', async () => {
    const prisma = makePrismaConHistorial();
    const scope = makeScopeService(true);
    const svc = makeService(prisma, scope);

    const result = await svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'DIRECTOR_CARRERA');

    expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(U_ID, 'DIRECTOR_CARRERA', CARRERA_ID);
    expect(result.historial).toHaveLength(1);
  });

  test('19. DIRECTOR_CARRERA fuera de scope → ForbiddenException', async () => {
    const prisma = makePrismaConHistorial();
    const scope = makeScopeService(false);
    const svc = makeService(prisma, scope);

    await expect(
      svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'DIRECTOR_CARRERA'),
    ).rejects.toThrow(ForbiddenException);
  });

  test('20. DECANO con scope correcto → retorna historial', async () => {
    const prisma = makePrismaConHistorial();
    const scope = makeScopeService(true);
    const svc = makeService(prisma, scope);

    const result = await svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'DECANO');

    expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(U_ID, 'DECANO', CARRERA_ID);
    expect(result.historial).toHaveLength(1);
  });

  test('21. DECANO fuera de scope → ForbiddenException', async () => {
    const prisma = makePrismaConHistorial();
    const scope = makeScopeService(false);
    const svc = makeService(prisma, scope);

    await expect(
      svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'DECANO'),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ── 22–23: obtenerHistorialPrograma — acceso DOCENTE ─────────────────────────

describe('obtenerHistorialPrograma — acceso DOCENTE', () => {
  test('22. DOCENTE con vinculación APROBADA → retorna historial', async () => {
    const prisma = makePrismaConHistorial();
    prisma.docente.findUnique = jest.fn().mockResolvedValue({ id: DOCENTE_ID });
    prisma.vinculacionCatedra.findFirst = jest.fn().mockResolvedValue({ id: 'vinc-id' });
    const svc = makeService(prisma);

    const result = await svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'DOCENTE');

    expect(prisma.vinculacionCatedra.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ estado: 'APROBADA' }) }),
    );
    expect(result.historial).toHaveLength(1);
  });

  test('23. DOCENTE sin vinculación APROBADA → ForbiddenException', async () => {
    const prisma = makePrismaConHistorial();
    prisma.docente.findUnique = jest.fn().mockResolvedValue({ id: DOCENTE_ID });
    prisma.vinculacionCatedra.findFirst = jest.fn().mockResolvedValue(null);
    const svc = makeService(prisma);

    await expect(
      svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'DOCENTE'),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ── 24–25: obtenerHistorialPrograma — datos retornados ───────────────────────

describe('obtenerHistorialPrograma — datos retornados', () => {
  test('24. retorna historial + solicitudes con mensajes anidados', async () => {
    const solicitudConMensajes = {
      ...makeSolicitud('CORRECCIONES_SOLICITADAS'),
      mensajes: [
        { id: 'msg-1', tipo: 'CORRECCION', contenido: 'Corregir sección 2', fechaCreacion: new Date(), usuario: { id: 'dir-id', nombre: 'Dir', apellido: 'Test' } },
        { id: 'msg-2', tipo: 'RESPUESTA',  contenido: 'Corregido',          fechaCreacion: new Date(), usuario: { id: 'doc-id', nombre: 'Doc', apellido: 'Test' } },
      ],
    };
    const progConDatos = {
      ...makeProgramaCompleto(),
      historial: [{ id: 'h1', accion: 'ACTUALIZACION', fecha: new Date(), usuario: { id: U_ID, nombre: 'T', apellido: 'U' } }],
      solicitudes: [solicitudConMensajes],
    };
    const prisma = makePrisma();
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue(progConDatos);
    const svc = makeService(prisma);

    const result = await svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'SECRETARIA_ACADEMICA');

    expect(result.historial).toHaveLength(1);
    expect(result.solicitudes).toHaveLength(1);
    expect(result.solicitudes[0].mensajes).toHaveLength(2);
    expect(result.solicitudes[0].mensajes[0].tipo).toBe('CORRECCION');
    expect(result.solicitudes[0].mensajes[1].tipo).toBe('RESPUESTA');
  });

  test('25. materia sin programa registrado → retorna { historial: [], solicitudes: [] }', async () => {
    const prisma = makePrisma();
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue(null);
    const svc = makeService(prisma);

    const result = await svc.obtenerHistorialPrograma(MATERIA_ID, U_ID, 'SECRETARIA_ACADEMICA');

    expect(result).toEqual({ historial: [], solicitudes: [] });
  });
});
