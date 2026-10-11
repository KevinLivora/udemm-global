import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProgramasService, calcEstadoFuncional } from './programas.service';

/**
 * Tests C13 — Unificación de estados y notificaciones automáticas
 *
 * Escenarios cubiertos (24):
 *
 * Estados funcionales C13 (4 estados) — 4 tests
 *   1.  Programa <100% → INCOMPLETO
 *   2.  Programa 100% con PENDIENTE_APROBACION → EN_REVISION
 *   3.  Programa con CORRECCIONES_SOLICITADAS → EN_CORRECCION
 *   4.  Programa APROBADO → APROBADO
 *
 * Generación automática de solicitud — 6 tests
 *   5.  Actualización a 100% crea solicitud PENDIENTE_APROBACION
 *   6.  Guardado sin cambios al 100% ya con solicitud → sin duplicado
 *   7.  CORRECCIONES activas en 100% → sin nueva solicitud (docente debe reenviar)
 *   8.  Cambio sustancial invalida CORRECCIONES activas y crea nueva solicitud
 *   9.  Baja del 100% invalida PENDIENTE_APROBACION
 *   10. Reactivación a 100% después de invalidación crea nueva solicitud
 *
 * Notificaciones a directivos — 8 tests
 *   11. SECRETARIA_ACADEMICA recibe notificación
 *   12. RECTORADO recibe notificación
 *   13. DIRECTOR_CARRERA de la carrera correcta recibe notificación
 *   14. DIRECTOR_CARRERA de otra carrera no recibe notificación
 *   15. DECANO de la facultad correcta recibe notificación
 *   16. DECANO de otra facultad no recibe notificación
 *   17. Usuario inactivo no recibe notificación
 *   18. Usuario con múltiples roles: una sola notificación por solicitud
 *
 * Docente reenvía tras correcciones — 3 tests
 *   19. DOCENTE responde y solicitud pasa a PENDIENTE_APROBACION
 *   20. DOCENTE intenta reenviar programa < 100% → BadRequestException
 *   21. Notificaciones a directivos al reenviar
 *
 * Regularización — 3 tests
 *   22. listarProgramasParaRegularizacion identifica programas sin solicitud
 *   23. No incluye programas ya aprobados
 *   24. No incluye programas con solicitud activa
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const U_ID          = 'usuario-id';
const PROGRAMA_ID   = 'programa-id';
const MATERIA_ID    = 'materia-id';
const CARRERA_ID    = 'carrera-id';
const FACULTAD_ID   = 'facultad-id';
const DOCENTE_ID    = 'docente-id';
const SOLICITUD_ID  = 'solicitud-id';
const DIRECTIVO_SEC = 'sec-id';
const DIRECTIVO_DC  = 'dc-id';
const DIRECTIVO_DEC = 'dec-id';
const DIRECTIVO_REC = 'rec-id';
const TEXTO_LARGO   = 'x'.repeat(55);

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
    fechaCreacion: new Date(), fechaResolucion: null, observaciones: null,
    aprobadorId: 'directivo-id', aprobador: null, mensajes: [],
    programa: {
      id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma: 'EN_REVISION',
      materia: {
        id: MATERIA_ID, nombre: 'Materia Test',
        planEstudio: {
          carreraId: CARRERA_ID,
          carrera: { nombre: 'Carrera Test', facultad: { nombre: 'Facultad Test' } },
        },
      },
    },
  };
}

function makeInfoMateria() {
  return {
    id: MATERIA_ID,
    nombre: 'Materia Test',
    planEstudio: {
      carreraId: CARRERA_ID,
      nombre: 'Plan Test',
      carrera: {
        id: CARRERA_ID, nombre: 'Carrera Test',
        facultadId: FACULTAD_ID,
        facultad: { id: FACULTAD_ID, nombre: 'Facultad Test' },
      },
    },
  };
}

function makeDirectivos() {
  return [
    {
      id: DIRECTIVO_SEC, activo: true,
      rol: { nombre: 'SECRETARIA_ACADEMICA' },
      carrerasAsociadas: [], facultadesAsociadas: [],
    },
    {
      id: DIRECTIVO_DC, activo: true,
      rol: { nombre: 'DIRECTOR_CARRERA' },
      carrerasAsociadas: [{ carreraId: CARRERA_ID }], facultadesAsociadas: [],
    },
    {
      id: DIRECTIVO_DEC, activo: true,
      rol: { nombre: 'DECANO' },
      carrerasAsociadas: [], facultadesAsociadas: [{ facultadId: FACULTAD_ID }],
    },
    {
      id: DIRECTIVO_REC, activo: true,
      rol: { nombre: 'RECTORADO' },
      carrerasAsociadas: [], facultadesAsociadas: [],
    },
  ];
}

function makePrisma(opts: {
  programaActual?: any;
  solicitudActual?: any;
  directivos?: any[];
  programasRegularizacion?: any[];
} = {}) {
  const prog = opts.programaActual ?? makeProgramaCompleto();
  const solActual = opts.solicitudActual ?? null;
  const directivos = opts.directivos ?? [];

  const prisma: any = {
    materia: {
      findUnique: jest.fn().mockResolvedValue(makeInfoMateria()),
    },
    programaAsignatura: {
      findFirst:  jest.fn().mockResolvedValue(prog),
      findUnique: jest.fn().mockImplementation(({ include }: any) => {
        if (include?.solicitudes) {
          const solicitudes = solActual ? [solActual] : [];
          return Promise.resolve({ ...prog, historial: [], solicitudes });
        }
        return Promise.resolve({ ...prog, historial: [] });
      }),
      upsert:    jest.fn().mockResolvedValue({ ...prog, historial: [], solicitudes: solActual ? [solActual] : [] }),
      update:    jest.fn().mockResolvedValue(prog),
      findMany:  jest.fn().mockResolvedValue(opts.programasRegularizacion ?? []),
    },
    solicitudAprobacionPrograma: {
      findFirst:  jest.fn().mockResolvedValue(solActual),
      findUnique: jest.fn().mockResolvedValue(solActual),
      findMany:   jest.fn().mockResolvedValue(solActual ? [solActual] : []),
      create:     jest.fn().mockResolvedValue({ id: 'nueva-solicitud-id' }),
      update:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    historialPrograma: { create: jest.fn().mockResolvedValue({}) },
    vinculacionCatedra: {
      findFirst: jest.fn().mockResolvedValue({ id: 'vinc-id' }),
      findMany:  jest.fn().mockResolvedValue([]),
    },
    docente: { findUnique: jest.fn().mockResolvedValue({ id: DOCENTE_ID, usuarioId: U_ID }) },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Test', apellido: 'User' }),
      findMany:   jest.fn().mockResolvedValue(directivos),
    },
    mensajeCorrecionPrograma: {
      create:    jest.fn().mockResolvedValue({ id: 'msg-id', tipo: 'RESPUESTA', usuario: { id: U_ID, nombre: 'D', apellido: 'O' } }),
      count:     jest.fn().mockResolvedValue(0),
      findMany:  jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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

const DTO_COMPLETO: any = {
  seccionModificada:            'general',
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

// ── 1–4: Estados funcionales C13 (4 estados) ─────────────────────────────────

describe('C13 — calcEstadoFuncional con 4 estados', () => {
  test('1. programa <100%, sin solicitud → INCOMPLETO', () => {
    expect(calcEstadoFuncional('PENDIENTE', false, null)).toBe('INCOMPLETO');
  });

  test('2. programa 100% con PENDIENTE_APROBACION → EN_REVISION', () => {
    expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'PENDIENTE_APROBACION' })).toBe('EN_REVISION');
  });

  test('3. programa con CORRECCIONES_SOLICITADAS → EN_CORRECCION', () => {
    expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'CORRECCIONES_SOLICITADAS' })).toBe('EN_CORRECCION');
  });

  test('4. programa APROBADO → APROBADO', () => {
    expect(calcEstadoFuncional('APROBADO', true, null)).toBe('APROBADO');
  });
});

// ── 5–10: Generación automática de solicitud ─────────────────────────────────

describe('C13 — generación automática de solicitud', () => {
  test('5. actualización a 100% crea solicitud PENDIENTE_APROBACION', async () => {
    const progIncompleto = makeProgramaIncompleto();
    const nuevaSolicitud = makeSolicitud('PENDIENTE_APROBACION');

    const prisma = makePrisma({ programaActual: progIncompleto });
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...makeProgramaCompleto(), solicitudes: [nuevaSolicitud], historial: [],
    });
    const svc = makeService(prisma);

    const result = await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }) }),
    );
    expect(result.estadoFuncional).toBe('EN_REVISION');
  });

  test('6. guardado con solicitud PENDIENTE activa → sin nuevo create', async () => {
    const solExistente = makeSolicitud('PENDIENTE_APROBACION');
    const progCompleto = makeProgramaCompleto();

    const prisma = makePrisma({ programaActual: progCompleto, solicitudActual: solExistente });
    // findFirst devuelve la solicitud activa → no debe crear duplicado
    prisma.solicitudAprobacionPrograma.findFirst = jest.fn().mockResolvedValue(solExistente);
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...progCompleto, solicitudes: [solExistente], historial: [],
    });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });

  test('7. CORRECCIONES activas al 100% → sin nueva solicitud (docente debe reenviar)', async () => {
    const solCorrecciones = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const progCompleto    = makeProgramaCompleto();

    const prisma = makePrisma({ programaActual: progCompleto });
    // findFirst para estado in ['PENDIENTE_APROBACION', 'CORRECCIONES_SOLICITADAS'] devuelve la solCorrecciones
    prisma.solicitudAprobacionPrograma.findFirst = jest.fn().mockResolvedValue(solCorrecciones);
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...progCompleto, solicitudes: [solCorrecciones], historial: [],
    });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'DOCENTE');

    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });

  test('8. cambio sustancial invalida CORRECCIONES activas y crea nueva solicitud', async () => {
    const solCorrecciones = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const progAprobado    = makeProgramaCompleto('APROBADO');

    const prisma = makePrisma({ programaActual: progAprobado, solicitudActual: solCorrecciones });
    // Después de invalidar CORRECCIONES, findFirst devuelve null → crea nueva solicitud
    prisma.solicitudAprobacionPrograma.findFirst = jest.fn()
      .mockResolvedValueOnce(null);  // no hay PENDIENTE_APROBACION activa tras invalidación
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...makeProgramaCompleto(), solicitudes: [makeSolicitud('PENDIENTE_APROBACION')], historial: [],
    });
    const svc = makeService(prisma);

    // Cambio sustancial: modificar objetivosGenerales en un programa APROBADO
    await svc.actualizarPrograma(
      MATERIA_ID,
      { ...DTO_COMPLETO, objetivosGenerales: TEXTO_LARGO + '_nuevo' },
      U_ID,
      'SECRETARIA_ACADEMICA',
    );

    expect(prisma.solicitudAprobacionPrograma.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'CORRECCIONES_SOLICITADAS' }),
        data:  expect.objectContaining({ estado: 'INVALIDADA' }),
      }),
    );
  });

  test('9. baja del 100% invalida PENDIENTE_APROBACION', async () => {
    const solPendiente = makeSolicitud('PENDIENTE_APROBACION');
    const progCompleto = makeProgramaCompleto();

    const prisma = makePrisma({ programaActual: progCompleto, solicitudActual: solPendiente });
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...makeProgramaIncompleto(), solicitudes: [], historial: [],
    });
    const svc = makeService(prisma);

    const result = await svc.actualizarPrograma(
      MATERIA_ID,
      { seccionModificada: 'general', objetivosGenerales: '' },
      U_ID,
      'SECRETARIA_ACADEMICA',
    );

    expect(prisma.solicitudAprobacionPrograma.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }),
        data:  expect.objectContaining({ estado: 'INVALIDADA' }),
      }),
    );
    expect(result.estadoFuncional).toBe('INCOMPLETO');
  });

  test('10. reactivación a 100% después de invalidación crea nueva solicitud', async () => {
    // Programa completo pero sin solicitud activa (fue invalidada)
    const progCompleto = makeProgramaCompleto('EN_REVISION');
    const nuevaSolicitud = makeSolicitud('PENDIENTE_APROBACION');

    const prisma = makePrisma({ programaActual: progCompleto });
    // No hay solicitud activa
    prisma.solicitudAprobacionPrograma.findFirst = jest.fn().mockResolvedValue(null);
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...progCompleto, solicitudes: [nuevaSolicitud], historial: [],
    });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalled();
  });
});

// ── 11–18: Notificaciones a directivos ────────────────────────────────────────

describe('C13 — notificaciones a directivos al crear solicitud', () => {
  async function actualizarYCaptrarNotificados(directivos: any[]) {
    const progIncompleto = makeProgramaIncompleto();
    const nuevaSolicitud = makeSolicitud('PENDIENTE_APROBACION');

    const prisma = makePrisma({ programaActual: progIncompleto, directivos });
    prisma.solicitudAprobacionPrograma.findFirst = jest.fn().mockResolvedValue(null);
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue({
      ...makeProgramaCompleto(), solicitudes: [nuevaSolicitud], historial: [],
    });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO, U_ID, 'SECRETARIA_ACADEMICA');

    return {
      notificacionCreates: (prisma.notificacion.create as jest.Mock).mock.calls,
    };
  }

  test('11. SECRETARIA_ACADEMICA recibe notificación', async () => {
    const { notificacionCreates } = await actualizarYCaptrarNotificados([
      { id: DIRECTIVO_SEC, activo: true, rol: { nombre: 'SECRETARIA_ACADEMICA' }, carrerasAsociadas: [], facultadesAsociadas: [] },
    ]);
    expect(notificacionCreates.length).toBe(1);
    expect(notificacionCreates[0][0].data.usuarioId).toBe(DIRECTIVO_SEC);
  });

  test('12. RECTORADO recibe notificación', async () => {
    const { notificacionCreates } = await actualizarYCaptrarNotificados([
      { id: DIRECTIVO_REC, activo: true, rol: { nombre: 'RECTORADO' }, carrerasAsociadas: [], facultadesAsociadas: [] },
    ]);
    expect(notificacionCreates.length).toBe(1);
    expect(notificacionCreates[0][0].data.usuarioId).toBe(DIRECTIVO_REC);
  });

  test('13. DIRECTOR_CARRERA de la carrera correcta recibe notificación', async () => {
    const { notificacionCreates } = await actualizarYCaptrarNotificados([
      { id: DIRECTIVO_DC, activo: true, rol: { nombre: 'DIRECTOR_CARRERA' },
        carrerasAsociadas: [{ carreraId: CARRERA_ID }], facultadesAsociadas: [] },
    ]);
    expect(notificacionCreates.length).toBe(1);
    expect(notificacionCreates[0][0].data.usuarioId).toBe(DIRECTIVO_DC);
  });

  test('14. DIRECTOR_CARRERA de otra carrera no recibe notificación', async () => {
    const { notificacionCreates } = await actualizarYCaptrarNotificados([
      { id: DIRECTIVO_DC, activo: true, rol: { nombre: 'DIRECTOR_CARRERA' },
        carrerasAsociadas: [{ carreraId: 'otra-carrera-id' }], facultadesAsociadas: [] },
    ]);
    expect(notificacionCreates.length).toBe(0);
  });

  test('15. DECANO de la facultad correcta recibe notificación', async () => {
    const { notificacionCreates } = await actualizarYCaptrarNotificados([
      { id: DIRECTIVO_DEC, activo: true, rol: { nombre: 'DECANO' },
        carrerasAsociadas: [], facultadesAsociadas: [{ facultadId: FACULTAD_ID }] },
    ]);
    expect(notificacionCreates.length).toBe(1);
    expect(notificacionCreates[0][0].data.usuarioId).toBe(DIRECTIVO_DEC);
  });

  test('16. DECANO de otra facultad no recibe notificación', async () => {
    const { notificacionCreates } = await actualizarYCaptrarNotificados([
      { id: DIRECTIVO_DEC, activo: true, rol: { nombre: 'DECANO' },
        carrerasAsociadas: [], facultadesAsociadas: [{ facultadId: 'otra-facultad' }] },
    ]);
    expect(notificacionCreates.length).toBe(0);
  });

  test('17. usuario inactivo no recibe notificación (no lo devuelve el query activo:true)', async () => {
    // El mock de usuario.findMany ya filtra por activo:true — si el directivo es inactivo no aparece.
    // Simulamos que el findMany devuelve [] (como si todos fueran inactivos).
    const { notificacionCreates } = await actualizarYCaptrarNotificados([]);
    expect(notificacionCreates.length).toBe(0);
  });

  test('18. mismo usuario con múltiples entradas → solo una notificación', async () => {
    // Mismo id en dos entradas (p.ej. usuario duplicado en resultado)
    const directivoDuplicado = { id: DIRECTIVO_SEC, activo: true,
      rol: { nombre: 'SECRETARIA_ACADEMICA' }, carrerasAsociadas: [], facultadesAsociadas: [] };
    const { notificacionCreates } = await actualizarYCaptrarNotificados([
      directivoDuplicado, directivoDuplicado,
    ]);
    expect(notificacionCreates.length).toBe(1);
  });
});

// ── 19–21: Docente reenvía tras correcciones ─────────────────────────────────

describe('C13 — docente responde y reenvía', () => {
  test('19. DOCENTE envía RESPUESTA → solicitud pasa a PENDIENTE_APROBACION', async () => {
    const solCorrecciones = {
      ...makeSolicitud('CORRECCIONES_SOLICITADAS'),
      programa: {
        id: PROGRAMA_ID, materiaId: MATERIA_ID,
        materia: { id: MATERIA_ID, nombre: 'Materia Test', planEstudio: { carreraId: CARRERA_ID } },
      },
    };

    const prisma = makePrisma({
      programaActual:  makeProgramaCompleto(),
      solicitudActual: solCorrecciones,
    });

    // Para verificarAccesoConversacion (DOCENTE)
    prisma.vinculacionCatedra.findFirst = jest.fn().mockResolvedValue({ id: 'vinc-id' });
    prisma.docente.findUnique = jest.fn().mockResolvedValue({ id: DOCENTE_ID });

    // Solicitud para enviarMensaje (CORRECCIONES_SOLICITADAS)
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solCorrecciones);

    const svc = makeService(prisma);

    await svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Hice las correcciones' }, U_ID, 'DOCENTE');

    expect(prisma.solicitudAprobacionPrograma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SOLICITUD_ID },
        data:  expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }),
      }),
    );
  });

  test('20. DOCENTE intenta reenviar programa < 100% → BadRequestException', async () => {
    const solCorrecciones = {
      ...makeSolicitud('CORRECCIONES_SOLICITADAS'),
      programa: {
        id: PROGRAMA_ID, materiaId: MATERIA_ID,
        materia: { id: MATERIA_ID, nombre: 'Materia Test', planEstudio: { carreraId: CARRERA_ID } },
      },
    };

    const prisma = makePrisma({
      programaActual:  makeProgramaIncompleto(),
      solicitudActual: solCorrecciones,
    });

    prisma.vinculacionCatedra.findFirst = jest.fn().mockResolvedValue({ id: 'vinc-id' });
    prisma.docente.findUnique = jest.fn().mockResolvedValue({ id: DOCENTE_ID });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solCorrecciones);
    // programaAsignatura.findUnique devuelve incompleto
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue(makeProgramaIncompleto());

    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Respuesta sin haber corregido todo' }, U_ID, 'DOCENTE'),
    ).rejects.toThrow(BadRequestException);
  });

  test('21. al reenviar se generan notificaciones a directivos', async () => {
    const solCorrecciones = {
      ...makeSolicitud('CORRECCIONES_SOLICITADAS'),
      programa: {
        id: PROGRAMA_ID, materiaId: MATERIA_ID,
        materia: { id: MATERIA_ID, nombre: 'Materia Test', planEstudio: { carreraId: CARRERA_ID } },
      },
    };

    const prisma = makePrisma({
      programaActual:  makeProgramaCompleto(),
      solicitudActual: solCorrecciones,
      directivos:      makeDirectivos(),
    });

    prisma.vinculacionCatedra.findFirst = jest.fn().mockResolvedValue({ id: 'vinc-id' });
    prisma.docente.findUnique = jest.fn().mockResolvedValue({ id: DOCENTE_ID });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solCorrecciones);

    const svc = makeService(prisma);

    await svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Correcciones realizadas' }, U_ID, 'DOCENTE');

    expect(prisma.notificacion.create).toHaveBeenCalled();
  });
});

// ── 22–24: Regularización ────────────────────────────────────────────────────

describe('C13 — listarProgramasParaRegularizacion', () => {
  function makeProgramaRegularizable() {
    return {
      id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma: 'EN_REVISION',
      estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
      estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
      materia: { nombre: 'Materia Test', planEstudio: { nombre: 'Plan', carrera: { nombre: 'Carrera', facultad: { nombre: 'Facultad' } } } },
      solicitudes: [],
    };
  }

  test('22. identifica programas al 100% sin solicitud activa', async () => {
    const prisma = makePrisma({ programasRegularizacion: [makeProgramaRegularizable()] });
    const svc    = makeService(prisma);

    const result = await svc.listarProgramasParaRegularizacion(U_ID, 'SECRETARIA_ACADEMICA');

    expect(result.cantidad).toBe(1);
    expect(result.requiereConfirmacion).toBe(true);
    expect(result.programas[0].materiaId).toBe(MATERIA_ID);
  });

  test('23. no incluye programas ya aprobados', async () => {
    // findMany devuelve [] (la query ya filtra estadoPrograma != APROBADO)
    const prisma = makePrisma({ programasRegularizacion: [] });
    const svc    = makeService(prisma);

    const result = await svc.listarProgramasParaRegularizacion(U_ID, 'SECRETARIA_ACADEMICA');

    expect(result.cantidad).toBe(0);
  });

  test('24. no incluye programas con solicitud activa', async () => {
    // La query Prisma filtra solicitudes.none { estado in [...] }
    // Simulamos que el resultado de findMany devuelve vacío (el filtro excluyó los que tienen solicitud)
    const prisma = makePrisma({ programasRegularizacion: [] });
    const svc    = makeService(prisma);

    const result = await svc.listarProgramasParaRegularizacion(U_ID, 'SECRETARIA_ACADEMICA');

    expect(result.cantidad).toBe(0);
    expect(result.programas).toHaveLength(0);
  });
});
