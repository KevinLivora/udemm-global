import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProgramasService } from './programas.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/**
 * Tests C15 — Notificación automática al docente cuando un directivo
 * aprueba un Programa de Asignatura.
 *
 * Escenarios cubiertos (14):
 *
 *   1.  Aprobación correcta genera notificación para el docente vinculado
 *   2.  La notificación llega al docente correcto (docenteId)
 *   3.  El cuerpo contiene materia, carrera, plan, directivo, rolDirectivo y fechaAprobacion
 *   4.  El cuerpo incluye la asignatura correcta (materia.nombre)
 *   5.  Se identifica correctamente al aprobador (nombre completo del usuario)
 *   6.  Con varios docentes autorizados cada uno recibe su notificación
 *   7.  Sin docentes con vinculación APROBADA no se crea ninguna notificación
 *   8.  No se genera notificación duplicada para un mismo docente y solicitud
 *   9.  Una aprobación fallida (sin scope) no genera notificaciones
 *   10. La notificación queda asociada a la solicitud (solicitudProgramaId)
 *   11. El cuerpo incluye materiaId para el enlace VER PROGRAMA
 *   12. El tipo de notificación es APROBACION_PROGRAMA
 *   13. Se conserva el historial de aprobación (historialPrograma.create)
 *   14. Otro usuario no puede marcar como leída una notificación ajena
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const U_DIR         = 'usuario-directivo-id';
const U_DOC_A       = 'usuario-docente-a-id';
const U_DOC_B       = 'usuario-docente-b-id';
const PROGRAMA_ID   = 'programa-c15-id';
const MATERIA_ID    = 'materia-c15-id';
const CARRERA_ID    = 'carrera-c15-id';
const SOLICITUD_ID  = 'solicitud-c15-id';
const DOCENTE_A_ID  = 'docente-a-id';
const DOCENTE_B_ID  = 'docente-b-id';
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

function makeSolicitud(estado = 'PENDIENTE_APROBACION') {
  return {
    id: SOLICITUD_ID, programaId: PROGRAMA_ID, estado,
    fechaCreacion: new Date('2026-10-01'), fechaResolucion: null,
    observaciones: null, aprobadorId: null, aprobador: null,
    programa: {
      id: PROGRAMA_ID, materiaId: MATERIA_ID, estadoPrograma: 'EN_REVISION',
      materia: {
        id: MATERIA_ID, nombre: 'Bases de Datos II',
        planEstudio: {
          nombre: 'Plan 2024',
          carreraId: CARRERA_ID,
          carrera: { id: CARRERA_ID, nombre: 'Ing. en Sistemas', facultad: { nombre: 'Fac. Tecnología' } },
        },
      },
    },
  };
}

function makeVinculacionesUno() {
  return [
    { id: 'vinc-a', materiaId: MATERIA_ID, estado: 'APROBADA', docente: { id: DOCENTE_A_ID, usuarioId: U_DOC_A } },
  ];
}

function makeVinculacionesDos() {
  return [
    { id: 'vinc-a', materiaId: MATERIA_ID, estado: 'APROBADA', docente: { id: DOCENTE_A_ID, usuarioId: U_DOC_A } },
    { id: 'vinc-b', materiaId: MATERIA_ID, estado: 'APROBADA', docente: { id: DOCENTE_B_ID, usuarioId: U_DOC_B } },
  ];
}

function makePrisma(opts: {
  solicitud?: any;
  vinculaciones?: any[];
  notifExistente?: any;
  solicitudDentroTx?: any;
} = {}) {
  const sol  = opts.solicitud ?? makeSolicitud();
  const vinc = opts.vinculaciones ?? makeVinculacionesUno();
  const prog = makeProgramaCompleto();

  const prisma: any = {
    solicitudAprobacionPrograma: {
      findUnique: jest.fn().mockResolvedValue(sol),
      findFirst:  jest.fn().mockImplementation(({ where }: any) => {
        if (opts.solicitudDentroTx !== undefined) return Promise.resolve(opts.solicitudDentroTx);
        if (where?.estado && sol?.estado !== where.estado) return Promise.resolve(null);
        return Promise.resolve(sol);
      }),
      update:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    programaAsignatura: {
      findUnique: jest.fn().mockResolvedValue(prog),
      update:     jest.fn().mockResolvedValue({ ...prog, estadoPrograma: 'APROBADO' }),
    },
    historialPrograma: { create: jest.fn().mockResolvedValue({}) },
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue(vinc),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Laura', apellido: 'Méndez' }),
    },
    notificacion: {
      findFirst:  jest.fn().mockResolvedValue(opts.notifExistente ?? null),
      create:     jest.fn().mockResolvedValue({ id: 'notif-c15-id' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    docente: {
      findUnique: jest.fn().mockResolvedValue({ id: DOCENTE_A_ID, usuarioId: U_DOC_A }),
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

// ─────────────────────────────────────────────────────────────────────────────
// Tests 1–13: ProgramasService.aprobarSolicitud
// ─────────────────────────────────────────────────────────────────────────────

describe('C15 — Notificación al docente cuando se aprueba un Programa de Asignatura', () => {

  test('1. Aprobación correcta genera notificación para el docente vinculado', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
  });

  test('2. La notificación llega al docente correcto (docenteId)', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    const call = prisma.notificacion.create.mock.calls[0][0];
    expect(call.data.docenteId).toBe(DOCENTE_A_ID);
  });

  test('3. El cuerpo contiene materia, carrera, plan, directivo, rolDirectivo y fechaAprobacion', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    const call = prisma.notificacion.create.mock.calls[0][0];
    const cuerpo = JSON.parse(call.data.cuerpo);
    expect(cuerpo.materia).toBe('Bases de Datos II');
    expect(cuerpo.carrera).toBe('Ing. en Sistemas');
    expect(cuerpo.plan).toBe('Plan 2024');
    expect(cuerpo.directivo).toBe('Laura Méndez');
    expect(cuerpo.rolDirectivo).toBe('SECRETARIA_ACADEMICA');
    expect(cuerpo.fechaAprobacion).toBeDefined();
  });

  test('4. El cuerpo incluye la asignatura correcta (materia.nombre)', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'DIRECTOR_CARRERA');
    const call = prisma.notificacion.create.mock.calls[0][0];
    const cuerpo = JSON.parse(call.data.cuerpo);
    expect(cuerpo.materia).toBe('Bases de Datos II');
  });

  test('5. Se identifica correctamente al aprobador (nombre completo del usuario)', async () => {
    const prisma = makePrisma();
    prisma.usuario.findUnique = jest.fn().mockResolvedValue({ nombre: 'Carlos', apellido: 'Ruiz' });
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'DECANO');
    const call = prisma.notificacion.create.mock.calls[0][0];
    const cuerpo = JSON.parse(call.data.cuerpo);
    expect(cuerpo.directivo).toBe('Carlos Ruiz');
  });

  test('6. Con varios docentes autorizados cada uno recibe su notificación', async () => {
    const prisma = makePrisma({ vinculaciones: makeVinculacionesDos() });
    prisma.notificacion.findFirst = jest.fn().mockResolvedValue(null);
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'RECTORADO');
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(2);
    const docenteIds = prisma.notificacion.create.mock.calls.map((c: any[]) => c[0].data.docenteId);
    expect(docenteIds).toContain(DOCENTE_A_ID);
    expect(docenteIds).toContain(DOCENTE_B_ID);
  });

  test('7. Sin docentes con vinculación APROBADA no se crea ninguna notificación', async () => {
    const prisma = makePrisma({ vinculaciones: [] });
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  test('8. No se genera notificación duplicada para un mismo docente y solicitud no leída', async () => {
    const notifExistente = { id: 'notif-existente', docenteId: DOCENTE_A_ID, solicitudProgramaId: SOLICITUD_ID, leida: false };
    const prisma = makePrisma({ notifExistente });
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  test('9. Una aprobación fallida por scope incorrecto no genera notificaciones', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma, makeScopeService(false));
    await expect(svc.aprobarSolicitud(SOLICITUD_ID, U_DIR, 'DIRECTOR_CARRERA'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  test('10. La notificación queda asociada a la solicitud (solicitudProgramaId)', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    const call = prisma.notificacion.create.mock.calls[0][0];
    expect(call.data.solicitudProgramaId).toBe(SOLICITUD_ID);
  });

  test('11. El cuerpo incluye materiaId para el enlace VER PROGRAMA en el frontend', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    const call = prisma.notificacion.create.mock.calls[0][0];
    const cuerpo = JSON.parse(call.data.cuerpo);
    expect(cuerpo.materiaId).toBe(MATERIA_ID);
  });

  test('12. El tipo de la notificación es APROBACION_PROGRAMA', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    const call = prisma.notificacion.create.mock.calls[0][0];
    expect(call.data.tipo).toBe('APROBACION_PROGRAMA');
  });

  test('13. Se conserva el historial de aprobación (historialPrograma.create)', async () => {
    const prisma = makePrisma();
    await makeService(prisma).aprobarSolicitud(SOLICITUD_ID, U_DIR, 'SECRETARIA_ACADEMICA');
    expect(prisma.historialPrograma.create).toHaveBeenCalledTimes(1);
    const call = prisma.historialPrograma.create.mock.calls[0][0];
    expect(call.data.accion).toBe('APROBACION');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Test 14: NotificacionesService — acceso a notificaciones ajenas
// ─────────────────────────────────────────────────────────────────────────────

describe('C15 — Seguridad: notificaciones no son accesibles por otros usuarios', () => {

  test('14. Otro docente no puede marcar como leída una notificación ajena', async () => {
    const NOTIF_ID = 'notif-ajena-id';
    const docenteAjeno = { id: 'docente-ajeno-id', usuarioId: 'otro-usuario-id' };

    const prismaMock: any = {
      notificacion: {
        findUnique: jest.fn().mockResolvedValue({
          id: NOTIF_ID, docenteId: DOCENTE_A_ID, leida: false,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      docente: {
        findUnique: jest.fn().mockResolvedValue(docenteAjeno),
      },
    };

    const svc = new NotificacionesService(prismaMock as any);
    await expect(svc.marcarLeida(NOTIF_ID, 'otro-usuario-id', 'DOCENTE'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.notificacion.update).not.toHaveBeenCalled();
  });

});
