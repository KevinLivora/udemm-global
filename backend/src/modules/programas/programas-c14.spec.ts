import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ProgramasService, calcEstadoFuncional } from './programas.service';

/**
 * Tests C14 — Corrección funcional del circuito de aprobación y comunicación
 * bidireccional docente–directivo.
 *
 * Escenarios cubiertos (28):
 *
 * Fix ERROR 1 — estado funcional correcto tras correcciones (5 tests)
 *   1.  calcEstadoFuncional con CORRECCIONES sobre estadoPrograma APROBADO → EN_CORRECCION
 *   2.  calcEstadoFuncional con CORRECCIONES sobre estadoPrograma EN_REVISION → EN_CORRECCION
 *   3.  calcEstadoFuncional APROBADO sin solicitud activa → APROBADO (no regresión)
 *   4.  solicitarCorrecciones actualiza estadoPrograma a EN_REVISION en la transacción
 *   5.  solicitarCorrecciones sobre programa APROBADO también resets estadoPrograma
 *
 * Contenido de notificación al docente (5 tests)
 *   6.  solicitarCorrecciones crea notificación con tipo CORRECCIONES_PROGRAMA
 *   7.  Cuerpo de notificación contiene observaciones del directivo
 *   8.  Cuerpo de notificación contiene solicitudId
 *   9.  Cuerpo de notificación contiene materia, carrera, plan y nombre del directivo
 *   10. No se duplica notificación si ya existe una no leída para el mismo docente/solicitud
 *
 * Validación reenvío docente — enviarMensaje RESPUESTA (6 tests)
 *   11. DOCENTE puede responder cuando solicitud está en CORRECCIONES_SOLICITADAS
 *   12. DOCENTE con contenido vacío → BadRequestException
 *   13. DOCENTE con contenido solo espacios → BadRequestException
 *   14. DOCENTE con programa < 100% → BadRequestException
 *   15. DOCENTE en solicitud PENDIENTE_APROBACION → ConflictException
 *   16. DOCENTE sin vinculación APROBADA → ForbiddenException
 *
 * Ciclo completo correcciones → respuesta (4 tests)
 *   17. Respuesta DOCENTE reactiva solicitud a PENDIENTE_APROBACION
 *   18. Respuesta DOCENTE crea entrada en historial
 *   19. Respuesta DOCENTE llama a notificarDirectivos
 *   20. Múltiples ciclos de corrección son soportados (no se impide segundo ciclo)
 *
 * obtenerCorrecionesDocente (4 tests)
 *   21. Devuelve solicitudes CORRECCIONES_SOLICITADAS para las materias del docente
 *   22. Filtra únicamente materias con vinculación APROBADA
 *   23. Devuelve lista vacía cuando docente no tiene vinculaciones APROBADAS
 *   24. Sin perfil docente → ForbiddenException
 *
 * Conversación bidireccional — validaciones adicionales (4 tests)
 *   25. Directivo puede enviar CORRECCION en solicitud PENDIENTE_APROBACION
 *   26. Directivo puede enviar CORRECCION en solicitud CORRECCIONES_SOLICITADAS
 *   27. enviarMensaje rechaza contenido vacío para directivo también
 *   28. marcarMensajesLeidos marca tipo CORRECCION para DOCENTE
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const U_DIR        = 'usuario-directivo-id';
const U_DOC        = 'usuario-docente-id';
const PROGRAMA_ID  = 'programa-id';
const MATERIA_ID   = 'materia-id';
const CARRERA_ID   = 'carrera-id';
const FACULTAD_ID  = 'facultad-id';
const SOLICITUD_ID = 'solicitud-id';
const DOCENTE_ID   = 'docente-id';
const TEXTO_LARGO  = 'x'.repeat(55);
const OBSERVACION  = 'Falta desarrollar la bibliografía básica.';

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

function makeSolicitud(estado: string, extras: Record<string, unknown> = {}) {
  return {
    id: SOLICITUD_ID, programaId: PROGRAMA_ID, estado,
    fechaCreacion: new Date('2026-01-01'), fechaResolucion: null,
    observaciones: null, aprobadorId: U_DIR, aprobador: null,
    mensajes: [],
    programa: {
      id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma: 'EN_REVISION',
      materia: {
        id: MATERIA_ID, nombre: 'Sistemas Distribuidos',
        planEstudio: {
          nombre: 'Plan 2024',
          carreraId: CARRERA_ID,
          carrera: {
            id: CARRERA_ID, nombre: 'Ing. Informática',
            facultadId: FACULTAD_ID,
            facultad: { id: FACULTAD_ID, nombre: 'Fac. Ingeniería' },
          },
        },
      },
    },
    ...extras,
  };
}

function makeMateria() {
  return {
    id: MATERIA_ID, nombre: 'Sistemas Distribuidos',
    planEstudio: {
      carreraId: CARRERA_ID,
      nombre: 'Plan 2024',
      carrera: {
        id: CARRERA_ID, nombre: 'Ing. Informática',
        facultadId: FACULTAD_ID,
        facultad: { id: FACULTAD_ID, nombre: 'Fac. Ingeniería' },
      },
    },
  };
}

function makePrisma(opts: {
  prog?: any;
  solicitud?: any;
  progIncompleto?: boolean;
  notifExistente?: any;
  vinculaciones?: any[];
  docenteProfile?: any;
} = {}) {
  const prog = opts.prog ?? makeProgramaCompleto();
  const sol  = opts.solicitud ?? null;
  const notifExistente = opts.notifExistente ?? null;
  const vinculaciones  = opts.vinculaciones ?? [{ id: 'vinc-id', materiaId: MATERIA_ID, docente: { id: DOCENTE_ID, usuarioId: U_DOC } }];
  const docenteProfile = opts.docenteProfile ?? { id: DOCENTE_ID, usuarioId: U_DOC };

  const prisma: any = {
    materia: {
      findUnique: jest.fn().mockResolvedValue(makeMateria()),
    },
    programaAsignatura: {
      findFirst:  jest.fn().mockResolvedValue(opts.progIncompleto ? makeProgramaIncompleto() : prog),
      findUnique: jest.fn().mockImplementation(({ include }: any) => {
        if (include?.solicitudes) {
          return Promise.resolve({ ...prog, historial: [], solicitudes: sol ? [sol] : [] });
        }
        return Promise.resolve(opts.progIncompleto ? makeProgramaIncompleto() : prog);
      }),
      upsert:    jest.fn().mockResolvedValue({ ...prog, historial: [], solicitudes: sol ? [sol] : [] }),
      update:    jest.fn().mockResolvedValue(prog),
      findMany:  jest.fn().mockResolvedValue([]),
    },
    solicitudAprobacionPrograma: {
      findFirst:  jest.fn().mockResolvedValue(sol),
      findUnique: jest.fn().mockResolvedValue(sol),
      findMany:   jest.fn().mockResolvedValue(sol ? [sol] : []),
      create:     jest.fn().mockResolvedValue({ id: 'nueva-solicitud-id', estado: 'PENDIENTE_APROBACION' }),
      update:     jest.fn().mockResolvedValue(sol ? { ...sol, estado: 'CORRECCIONES_SOLICITADAS' } : {}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    historialPrograma: { create: jest.fn().mockResolvedValue({}) },
    vinculacionCatedra: {
      findFirst: jest.fn().mockResolvedValue(vinculaciones[0] ?? null),
      findMany:  jest.fn().mockResolvedValue(vinculaciones),
    },
    docente: {
      findUnique: jest.fn().mockResolvedValue(docenteProfile),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Ana', apellido: 'García' }),
      findMany:   jest.fn().mockResolvedValue([]),
    },
    mensajeCorrecionPrograma: {
      create:    jest.fn().mockResolvedValue({ id: 'msg-id', tipo: 'RESPUESTA', usuario: { id: U_DOC, nombre: 'Doc', apellido: 'Test' } }),
      findMany:  jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notificacion: {
      findFirst:  jest.fn().mockResolvedValue(notifExistente),
      create:     jest.fn().mockResolvedValue({ id: 'notif-id' }),
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

// ── 1–5: Fix ERROR 1 — estado funcional correcto tras correcciones ───────────

describe('C14 — Fix ERROR 1: estadoFuncional correcto tras correcciones', () => {
  test('1. calcEstadoFuncional con CORRECCIONES sobre estadoPrograma APROBADO → EN_CORRECCION', () => {
    // Antes del fix, si la solicitud fuese null retornaba 'APROBADO'
    expect(calcEstadoFuncional('APROBADO', true, { estado: 'CORRECCIONES_SOLICITADAS' })).toBe('EN_CORRECCION');
  });

  test('2. calcEstadoFuncional con CORRECCIONES sobre estadoPrograma EN_REVISION → EN_CORRECCION', () => {
    expect(calcEstadoFuncional('EN_REVISION', true, { estado: 'CORRECCIONES_SOLICITADAS' })).toBe('EN_CORRECCION');
  });

  test('3. calcEstadoFuncional APROBADO sin solicitud activa → APROBADO (sin regresión)', () => {
    expect(calcEstadoFuncional('APROBADO', true, null)).toBe('APROBADO');
    expect(calcEstadoFuncional('APROBADO', true, { estado: 'APROBADO' })).toBe('APROBADO');
    expect(calcEstadoFuncional('APROBADO', true, { estado: 'INVALIDADA' })).toBe('APROBADO');
  });

  test('4. solicitarCorrecciones actualiza estadoPrograma a EN_REVISION en la transacción', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: OBSERVACION }, U_DIR, 'SECRETARIA_ACADEMICA');

    const updateCall = prisma.programaAsignatura.update.mock.calls.find(
      (call: any[]) => call[0]?.data?.estadoPrograma === 'EN_REVISION',
    );
    expect(updateCall).toBeDefined();
  });

  test('5. solicitarCorrecciones sobre programa APROBADO también resets estadoPrograma a EN_REVISION', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const progAprobado = makeProgramaCompleto('APROBADO');
    const solConProgAprobado = {
      ...sol,
      programa: { ...sol.programa, estadoPrograma: 'APROBADO' },
    };
    const prisma = makePrisma({ prog: progAprobado, solicitud: solConProgAprobado });
    const svc = makeService(prisma);

    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: OBSERVACION }, U_DIR, 'SECRETARIA_ACADEMICA');

    const updateCall = prisma.programaAsignatura.update.mock.calls.find(
      (call: any[]) => call[0]?.data?.estadoPrograma === 'EN_REVISION',
    );
    expect(updateCall).toBeDefined();
  });
});

// ── 6–10: Contenido de notificación al docente ───────────────────────────────

describe('C14 — Contenido de notificación al docente', () => {
  test('6. solicitarCorrecciones crea notificación con tipo CORRECCIONES_PROGRAMA', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      solicitud: sol,
      vinculaciones: [{ id: 'v1', materiaId: MATERIA_ID, docente: { id: DOCENTE_ID, usuarioId: U_DOC } }],
    });
    const svc = makeService(prisma);

    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: OBSERVACION }, U_DIR, 'DIRECTOR_CARRERA');

    const createCall = prisma.notificacion.create.mock.calls[0]?.[0]?.data;
    expect(createCall?.tipo).toBe('CORRECCIONES_PROGRAMA');
  });

  test('7. Cuerpo de notificación contiene observaciones del directivo', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      solicitud: sol,
      vinculaciones: [{ id: 'v1', materiaId: MATERIA_ID, docente: { id: DOCENTE_ID, usuarioId: U_DOC } }],
    });
    const svc = makeService(prisma);

    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: OBSERVACION }, U_DIR, 'SECRETARIA_ACADEMICA');

    const cuerpoStr = prisma.notificacion.create.mock.calls[0]?.[0]?.data?.cuerpo;
    const cuerpo = JSON.parse(cuerpoStr);
    expect(cuerpo.observaciones).toBe(OBSERVACION);
  });

  test('8. Cuerpo de notificación contiene solicitudId', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      solicitud: sol,
      vinculaciones: [{ id: 'v1', materiaId: MATERIA_ID, docente: { id: DOCENTE_ID, usuarioId: U_DOC } }],
    });
    const svc = makeService(prisma);

    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: OBSERVACION }, U_DIR, 'SECRETARIA_ACADEMICA');

    const cuerpoStr = prisma.notificacion.create.mock.calls[0]?.[0]?.data?.cuerpo;
    const cuerpo = JSON.parse(cuerpoStr);
    expect(cuerpo.solicitudId).toBe(SOLICITUD_ID);
  });

  test('9. Cuerpo de notificación contiene materia, carrera, plan y nombre del directivo', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      solicitud: sol,
      vinculaciones: [{ id: 'v1', materiaId: MATERIA_ID, docente: { id: DOCENTE_ID, usuarioId: U_DOC } }],
    });
    const svc = makeService(prisma);

    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: OBSERVACION }, U_DIR, 'SECRETARIA_ACADEMICA');

    const cuerpoStr = prisma.notificacion.create.mock.calls[0]?.[0]?.data?.cuerpo;
    const cuerpo = JSON.parse(cuerpoStr);
    expect(cuerpo.materia).toBeTruthy();
    expect(cuerpo.carrera).toBeTruthy();
    expect(cuerpo.plan).toBeTruthy();
    expect(cuerpo.directivo).toBeTruthy();
  });

  test('10. No se duplica notificación si ya existe una no leída para el mismo docente/solicitud', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const notifExistente = { id: 'notif-existente', leida: false };
    const prisma = makePrisma({
      solicitud: sol,
      notifExistente,
      vinculaciones: [{ id: 'v1', materiaId: MATERIA_ID, docente: { id: DOCENTE_ID, usuarioId: U_DOC } }],
    });
    const svc = makeService(prisma);

    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: OBSERVACION }, U_DIR, 'SECRETARIA_ACADEMICA');

    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });
});

// ── 11–16: Validación reenvío docente ────────────────────────────────────────

describe('C14 — Validación reenvío docente (enviarMensaje RESPUESTA)', () => {
  test('11. DOCENTE puede responder cuando solicitud está en CORRECCIONES_SOLICITADAS', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Respuesta del docente.' }, U_DOC, 'DOCENTE'),
    ).resolves.toBeDefined();
  });

  test('12. DOCENTE con contenido vacío → BadRequestException', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: '' }, U_DOC, 'DOCENTE'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('13. DOCENTE con contenido solo espacios → BadRequestException', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: '   ' }, U_DOC, 'DOCENTE'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('14. DOCENTE con programa < 100% → BadRequestException', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol, progIncompleto: true });
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue(makeProgramaIncompleto());
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Ok corregido.' }, U_DOC, 'DOCENTE'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('15. DOCENTE en solicitud PENDIENTE_APROBACION → ConflictException', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Quiero responder.' }, U_DOC, 'DOCENTE'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('16. DOCENTE sin vinculación APROBADA → ForbiddenException', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({
      solicitud: sol,
      vinculaciones: [],
    });
    prisma.vinculacionCatedra.findFirst = jest.fn().mockResolvedValue(null);
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Sin vinculación.' }, U_DOC, 'DOCENTE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── 17–20: Ciclo completo correcciones → respuesta ───────────────────────────

describe('C14 — Ciclo correcciones → respuesta', () => {
  test('17. Respuesta DOCENTE reactiva solicitud a PENDIENTE_APROBACION', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Correcciones aplicadas.' }, U_DOC, 'DOCENTE');

    const updateCall = prisma.solicitudAprobacionPrograma.update.mock.calls.find(
      (call: any[]) => call[0]?.data?.estado === 'PENDIENTE_APROBACION',
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[0].data.fechaResolucion).toBeNull();
  });

  test('18. Respuesta DOCENTE crea entrada en historial', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Aplicadas las correcciones.' }, U_DOC, 'DOCENTE');

    expect(prisma.historialPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accion: 'ACTUALIZACION' }) }),
    );
  });

  test('19. Respuesta DOCENTE llama a notificarDirectivos', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const directivo = { id: 'sec-id', activo: true, rol: { nombre: 'SECRETARIA_ACADEMICA' }, carrerasAsociadas: [], facultadesAsociadas: [] };
    const prisma = makePrisma({ solicitud: sol });
    prisma.usuario.findMany = jest.fn().mockResolvedValue([directivo]);
    const svc = makeService(prisma);

    await svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Correcciones aplicadas.' }, U_DOC, 'DOCENTE');

    expect(prisma.notificacion.create).toHaveBeenCalled();
  });

  test('20. Múltiples ciclos de corrección son soportados (segunda corrección no bloqueada)', async () => {
    // Segundo ciclo: docente respondió → PENDIENTE → directivo solicita correcciones nuevamente
    const solPendiente = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({ solicitud: solPendiente });
    const svc = makeService(prisma);

    // Segunda ronda de correcciones
    await expect(
      svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: 'Segunda ronda.' }, U_DIR, 'SECRETARIA_ACADEMICA'),
    ).resolves.toBeDefined();

    const updateSolicitudCall = prisma.solicitudAprobacionPrograma.update.mock.calls.find(
      (call: any[]) => call[0]?.data?.estado === 'CORRECCIONES_SOLICITADAS',
    );
    expect(updateSolicitudCall).toBeDefined();
  });
});

// ── 21–24: obtenerCorrecionesDocente ─────────────────────────────────────────

describe('C14 — obtenerCorrecionesDocente', () => {
  test('21. Devuelve solicitudes CORRECCIONES_SOLICITADAS para las materias del docente', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    prisma.vinculacionCatedra.findMany = jest.fn().mockResolvedValue([{ materiaId: MATERIA_ID }]);
    prisma.solicitudAprobacionPrograma.findMany = jest.fn().mockResolvedValue([sol]);
    const svc = makeService(prisma);

    const result = await svc.obtenerCorrecionesDocente(U_DOC);

    expect(Array.isArray(result)).toBe(true);
    expect(prisma.solicitudAprobacionPrograma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'CORRECCIONES_SOLICITADAS' }),
      }),
    );
  });

  test('22. Filtra únicamente materias con vinculación APROBADA del docente', async () => {
    const prisma = makePrisma({});
    prisma.vinculacionCatedra.findMany = jest.fn().mockResolvedValue([{ materiaId: MATERIA_ID }]);
    prisma.solicitudAprobacionPrograma.findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService(prisma);

    await svc.obtenerCorrecionesDocente(U_DOC);

    expect(prisma.vinculacionCatedra.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ docenteId: DOCENTE_ID, estado: 'APROBADA' }),
      }),
    );
  });

  test('23. Devuelve lista vacía cuando docente no tiene vinculaciones APROBADAS', async () => {
    const prisma = makePrisma({});
    prisma.vinculacionCatedra.findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService(prisma);

    const result = await svc.obtenerCorrecionesDocente(U_DOC);

    expect(result).toEqual([]);
    expect(prisma.solicitudAprobacionPrograma.findMany).not.toHaveBeenCalled();
  });

  test('24. Sin perfil docente → ForbiddenException', async () => {
    const prisma = makePrisma({ docenteProfile: null });
    prisma.docente.findUnique = jest.fn().mockResolvedValue(null);
    const svc = makeService(prisma);

    await expect(svc.obtenerCorrecionesDocente(U_DOC)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── 25–28: Conversación bidireccional — validaciones adicionales ──────────────

describe('C14 — Conversación bidireccional: validaciones adicionales', () => {
  test('25. Directivo puede enviar CORRECCION en solicitud PENDIENTE_APROBACION', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Observación previa a la decisión.' }, U_DIR, 'DIRECTOR_CARRERA'),
    ).resolves.toBeDefined();

    const createCall = prisma.mensajeCorrecionPrograma.create.mock.calls[0]?.[0]?.data;
    expect(createCall?.tipo).toBe('CORRECCION');
  });

  test('26. Directivo puede enviar CORRECCION en solicitud CORRECCIONES_SOLICITADAS', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: 'Aclaración adicional.' }, U_DIR, 'SECRETARIA_ACADEMICA'),
    ).resolves.toBeDefined();
  });

  test('27. enviarMensaje rechaza contenido vacío para directivo también', async () => {
    const sol = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await expect(
      svc.enviarMensaje(SOLICITUD_ID, { contenido: '' }, U_DIR, 'SECRETARIA_ACADEMICA'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('28. marcarMensajesLeidos marca tipo CORRECCION como leído para DOCENTE', async () => {
    const sol = makeSolicitud('CORRECCIONES_SOLICITADAS');
    const prisma = makePrisma({ solicitud: sol });
    const svc = makeService(prisma);

    await svc.marcarMensajesLeidos(SOLICITUD_ID, U_DOC, 'DOCENTE');

    expect(prisma.mensajeCorrecionPrograma.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ solicitudId: SOLICITUD_ID, tipo: 'CORRECCION', leido: false }),
      }),
    );
  });
});
