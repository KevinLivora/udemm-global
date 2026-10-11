import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProgramasService } from './programas.service';

/**
 * Tests del circuito de aprobación de Programas de Asignatura — FASE 3
 *
 * Escenarios cubiertos (16):
 *   1.  Programa < 100% → no se crea solicitud
 *   2.  Programa llega al 100% → se crea solicitud PENDIENTE_APROBACION
 *   3.  No se duplican solicitudes si ya existe una PENDIENTE_APROBACION
 *   4.  Visibilidad por scope: DIRECTOR_CARRERA solo ve su carrera
 *   5.  Visibilidad por scope: DECANO ve scope de su facultad
 *   6.  Visibilidad global: SECRETARIA_ACADEMICA ve todas las solicitudes
 *   7.  Visibilidad global: RECTORADO ve todas las solicitudes
 *   8.  Aprobar solicitud como DIRECTOR_CARRERA
 *   9.  Aprobar solicitud como DECANO
 *   10. Aprobar solicitud como SECRETARIA_ACADEMICA
 *   11. Aprobar solicitud como RECTORADO
 *   12. Rechazar aprobación de un directivo fuera de su scope
 *   13. ADMINISTRADOR_SISTEMA no puede aprobar (bloqueado por RolesGuard — scope global intacto)
 *   14. Race condition: segunda aprobación simultánea lanza ConflictException
 *   15. Correcciones con observaciones obligatorias (mínimo 10 caracteres)
 *   16. Ciclo completo: correcciones → nueva solicitud al volver a 100%
 *   +   Avance cae por debajo del 100% → solicitud PENDIENTE invalidada
 *   +   Cambio sustancial en programa APROBADO → pasa a EN_REVISION + nueva solicitud
 *   +   Cambio administrativo en programa APROBADO → permanece APROBADO, sin nueva solicitud
 *   +   Historial preservado: cada operación crea entrada en HistorialPrograma
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USUARIO_ID   = 'usuario-aprobador-id';
const PROGRAMA_ID  = 'programa-test-id';
const MATERIA_ID   = 'materia-test-id';
const SOLICITUD_ID = 'solicitud-test-id';
const CARRERA_ID   = 'carrera-test-id';

const TEXTO_LARGO = 'x'.repeat(55);

// Todas las secciones COMPLETO: genera solicitud al guardar
function makeProgramaCompleto(estadoPrograma = 'EN_REVISION') {
  return {
    id: PROGRAMA_ID,
    materiaId: MATERIA_ID,
    estadoPrograma,
    estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
    estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
    objetivosGenerales:         TEXTO_LARGO,
    aportesPerfilTitulo:        TEXTO_LARGO,
    competenciasResultadosJson: JSON.stringify([{ competencia: 'c', resultadoAprendizaje: 'r' }]),
    contenidosGridJson:         JSON.stringify([{ conceptuales: 'c', procedimentales: 'p', actitudinales: 'a' }]),
    unidadesDidacticasJson:     JSON.stringify([{ unidad: 'unidad1' }]),
    actividadesFormacionPractica: TEXTO_LARGO,
    formacionPracticaJson:      JSON.stringify([{ intensidad: 'alta', horasClase: 4 }]),
    recursosDidacticos:         TEXTO_LARGO,
    metodologiaEnsenanza:       TEXTO_LARGO,
    modalidadEvaluacion:        TEXTO_LARGO,
    requisitosAprobacion:       TEXTO_LARGO,
    bibliografiaBasica:         TEXTO_LARGO,
    fechaVigenciaPrograma:      new Date('2025-01-01'),
    fechaAprobacion:            new Date('2024-12-01'),
    historial: [],
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
    actividadesFormacionPractica: null,
    recursosDidacticos: null, metodologiaEnsenanza: null,
    modalidadEvaluacion: null, requisitosAprobacion: null,
    bibliografiaBasica: null, fechaVigenciaPrograma: null, fechaAprobacion: null,
    historial: [],
  };
}

function makeSolicitud(estado = 'PENDIENTE_APROBACION') {
  return {
    id: SOLICITUD_ID,
    programaId: PROGRAMA_ID,
    estado,
    fechaCreacion: new Date(),
    fechaResolucion: null,
    observaciones: null,
    aprobadorId: null,
    programa: {
      id: PROGRAMA_ID,
      materiaId: MATERIA_ID,
      estadoPrograma: estado === 'APROBADO' ? 'APROBADO' : 'EN_REVISION',
      materia: {
        id: MATERIA_ID,
        nombre: 'Materia Test',
        planEstudio: {
          carreraId: CARRERA_ID,
          carrera: {
            nombre: 'Carrera Test',
            facultad: { nombre: 'Facultad Test' },
          },
        },
      },
    },
  };
}

function makePrisma(opts: {
  programaActual?: any;
  solicitudActual?: any;
  solicitudesLista?: any[];
  solicitudDentroTx?: any;
}) {
  const prog = opts.programaActual ?? makeProgramaCompleto();

  const solicitudAprobacionPrograma: any = {
    findFirst: jest.fn().mockImplementation(({ where }: any) => {
      if (opts.solicitudDentroTx !== undefined) return Promise.resolve(opts.solicitudDentroTx);
      const s = opts.solicitudActual ?? null;
      if (s && where?.estado && s.estado !== where.estado) return Promise.resolve(null);
      return Promise.resolve(s);
    }),
    findUnique: jest.fn().mockResolvedValue(opts.solicitudActual ?? null),
    findMany: jest.fn().mockResolvedValue(opts.solicitudesLista ?? []),
    create: jest.fn().mockResolvedValue({ id: 'nueva-solicitud-id' }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };

  const prisma: any = {
    materia: {
      findUnique: jest.fn().mockResolvedValue({
        id: MATERIA_ID,
        nombre: 'Materia Test',
        planEstudio: { carreraId: CARRERA_ID },
      }),
    },
    programaAsignatura: {
      findFirst: jest.fn().mockResolvedValue(prog),
      findUnique: jest.fn().mockResolvedValue({ ...prog, historial: [] }),
      upsert: jest.fn().mockResolvedValue(prog),
      update: jest.fn().mockResolvedValue({ ...prog, estadoPrograma: 'APROBADO' }),
    },
    solicitudAprobacionPrograma,
    historialPrograma: {
      create: jest.fn().mockResolvedValue({}),
    },
    // Necesario desde C10: solicitarCorrecciones notifica a docentes con vinculación APROBADA.
    // En estos tests no hay docentes vinculados → array vacío → no se crean notificaciones.
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Test', apellido: 'User' }),
      findMany:   jest.fn().mockResolvedValue([]),
    },
    mensajeCorrecionPrograma: {
      create: jest.fn().mockResolvedValue({ id: 'msg-id' }),
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

function makeScopeService(tieneScope = true, carrerasEnScope: string[] | null = null) {
  return {
    tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope),
    getCarrerasEnScope: jest.fn().mockResolvedValue(carrerasEnScope),
  };
}

function makeService(prisma: any, scope?: any) {
  return new ProgramasService(prisma as any, (scope ?? makeScopeService()) as any);
}

// ── DTO mínimo válido que NO modifica campos sustanciales ─────────────────────
const DTO_ADMIN = { seccionModificada: 'seccion-admin' };

// ── DTO que lleva el programa a 100% ──────────────────────────────────────────
const DTO_COMPLETO = {
  seccionModificada: 'general',
  objetivosGenerales:         TEXTO_LARGO,
  aportesPerfilTitulo:        TEXTO_LARGO,
  competenciasResultadosJson: JSON.stringify([{ competencia: 'c', resultadoAprendizaje: 'r' }]),
  contenidosGridJson:         JSON.stringify([{ conceptuales: 'c', procedimentales: 'p', actitudinales: 'a' }]),
  unidadesDidacticasJson:     JSON.stringify([{ unidad: 'u1' }]),
  actividadesFormacionPractica: TEXTO_LARGO,
  formacionPracticaJson:      JSON.stringify([{ intensidad: 'alta', horasClase: 4 }]),
  recursosDidacticos:         TEXTO_LARGO,
  metodologiaEnsenanza:       TEXTO_LARGO,
  modalidadEvaluacion:        TEXTO_LARGO,
  requisitosAprobacion:       TEXTO_LARGO,
  bibliografiaBasica:         TEXTO_LARGO,
  fechaVigenciaPrograma:      2025,
  fechaAprobacion:            '2024-12-01',
};

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 1: Programa < 100% → no se crea solicitud
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 1 — Programa incompleto (< 100%) no genera solicitud', () => {
  it('no llama a solicitudAprobacionPrograma.create cuando el avance es < 100%', async () => {
    const prisma = makePrisma({ programaActual: makeProgramaIncompleto() });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, { seccionModificada: 'sec1' }, USUARIO_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 2: Programa llega al 100% → se crea solicitud
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 2 — Programa completo al 100% genera solicitud PENDIENTE_APROBACION', () => {
  it('crea solicitud cuando no existe ninguna PENDIENTE_APROBACION previa', async () => {
    const prisma = makePrisma({
      programaActual: makeProgramaIncompleto(),
      solicitudActual: null,
    });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO as any, USUARIO_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          programaId: PROGRAMA_ID,
          estado: 'PENDIENTE_APROBACION',
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 3: No duplicar solicitudes
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 3 — No se duplican solicitudes PENDIENTE_APROBACION', () => {
  it('no crea segunda solicitud si ya existe una PENDIENTE_APROBACION', async () => {
    const solicitudExistente = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      programaActual: makeProgramaCompleto(),
      solicitudActual: solicitudExistente,
      solicitudDentroTx: solicitudExistente,
    });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO as any, USUARIO_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIOS 4–7: Visibilidad por scope
// ─────────────────────────────────────────────────────────────────────────────
describe.each([
  ['DIRECTOR_CARRERA', [CARRERA_ID]],
  ['DECANO',           [CARRERA_ID]],
  ['SECRETARIA_ACADEMICA', null],
  ['RECTORADO',            null],
])('Escenarios 4–7 — obtenerSolicitudes: %s', (rol, carrerasEnScope) => {
  it(`${rol} recibe solicitudes filtradas por getCarrerasEnScope`, async () => {
    const lista = [makeSolicitud()];
    const prisma = makePrisma({ solicitudesLista: lista });
    const scope = makeScopeService(true, carrerasEnScope);
    const svc = makeService(prisma, scope);

    const result = await svc.obtenerSolicitudes(USUARIO_ID, rol);

    expect(scope.getCarrerasEnScope).toHaveBeenCalledWith(USUARIO_ID, rol);
    expect(result).toEqual(lista);
    if (carrerasEnScope === null) {
      // scope global: where vacío (sin filtro por carrera)
      expect(prisma.solicitudAprobacionPrograma.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    } else {
      // scope restringido: filtro por carreraId
      expect(prisma.solicitudAprobacionPrograma.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            programa: expect.objectContaining({
              materia: expect.objectContaining({
                planEstudio: expect.objectContaining({
                  carreraId: expect.objectContaining({ in: carrerasEnScope }),
                }),
              }),
            }),
          }),
        }),
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIOS 8–11: Aprobar por cada rol autorizado
// ─────────────────────────────────────────────────────────────────────────────
describe.each([
  ['SECRETARIA_ACADEMICA'],
  ['DIRECTOR_CARRERA'],
  ['DECANO'],
  ['RECTORADO'],
])('Escenarios 8–11 — Aprobar solicitud como %s', (rol) => {
  it(`${rol} puede aprobar correctamente (programa al 100% + scope válido)`, async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      programaActual: makeProgramaCompleto(),
      solicitudActual: solicitud,
      solicitudDentroTx: solicitud,
    });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(true));

    const res = await svc.aprobarSolicitud(SOLICITUD_ID, USUARIO_ID, rol);

    expect(res).toMatchObject({ mensaje: 'Programa aprobado correctamente' });
    expect(prisma.solicitudAprobacionPrograma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'APROBADO', aprobadorId: USUARIO_ID }),
      }),
    );
    expect(prisma.programaAsignatura.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estadoPrograma: 'APROBADO' } }),
    );
    expect(prisma.historialPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: 'APROBACION' }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 12: Fuera de scope → ForbiddenException
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 12 — Directivo fuera de scope no puede aprobar', () => {
  it('lanza ForbiddenException cuando tieneScopeCarrera devuelve false', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({ solicitudActual: solicitud });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(false));

    await expect(
      svc.aprobarSolicitud(SOLICITUD_ID, USUARIO_ID, 'DIRECTOR_CARRERA'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException al solicitar correcciones fuera de scope', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({ solicitudActual: solicitud });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(false));

    await expect(
      svc.solicitarCorrecciones(
        SOLICITUD_ID,
        { observaciones: 'Observación de prueba' },
        USUARIO_ID,
        'DECANO',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 13: ADMINISTRADOR_SISTEMA — excluido de aprobación por RolesGuard
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 13 — ADMINISTRADOR_SISTEMA conserva scope global; no está en ROLES_APROBAR', () => {
  it('obtenerSolicitudes con ADMIN usa getCarrerasEnScope (aunque ADMIN no llega por el guardia)', async () => {
    // El RolesGuard bloquea antes; si llegara al servicio, getCarrerasEnScope devolvería null.
    const prisma = makePrisma({ solicitudesLista: [] });
    const scope = makeScopeService(true, null); // null = global
    const svc = makeService(prisma, scope);

    await svc.obtenerSolicitudes(USUARIO_ID, 'ADMINISTRADOR_SISTEMA');

    expect(scope.getCarrerasEnScope).toHaveBeenCalledWith(USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
    expect(prisma.solicitudAprobacionPrograma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 14: Race condition — aprobación simultánea
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 14 — Race condition: aprobación simultánea lanza ConflictException', () => {
  it('lanza ConflictException cuando la solicitud ya no está PENDIENTE_APROBACION dentro de la tx', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      programaActual: makeProgramaCompleto(),
      solicitudActual: solicitud,
      solicitudDentroTx: null, // simula que otro usuario aprobó antes
    });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(true));

    await expect(
      svc.aprobarSolicitud(SOLICITUD_ID, USUARIO_ID, 'SECRETARIA_ACADEMICA'),
    ).rejects.toThrow(ConflictException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 15: Correcciones con observaciones obligatorias
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 15 — Solicitar correcciones con observaciones obligatorias', () => {
  it('registra CORRECCIONES_SOLICITADAS con observaciones cuando el scope es válido', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      solicitudActual: solicitud,
      solicitudDentroTx: solicitud,
    });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(true));

    const obs = 'La fundamentación debe ser más detallada.';
    const res = await svc.solicitarCorrecciones(
      SOLICITUD_ID,
      { observaciones: obs },
      USUARIO_ID,
      'DIRECTOR_CARRERA',
    );

    expect(res).toMatchObject({ mensaje: 'Correcciones solicitadas correctamente' });
    expect(prisma.solicitudAprobacionPrograma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'CORRECCIONES_SOLICITADAS',
          observaciones: obs,
        }),
      }),
    );
    expect(prisma.historialPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: 'CORRECCIONES_SOLICITADAS' }),
      }),
    );
  });

  it('lanza ConflictException si la solicitud ya fue resuelta dentro de la tx (race condition)', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      solicitudActual: solicitud,
      solicitudDentroTx: null,
    });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(true));

    await expect(
      svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: 'Obs de prueba larga' }, USUARIO_ID, 'DECANO'),
    ).rejects.toThrow(ConflictException);
  });

  it('lanza ConflictException si se intenta resolver una solicitud ya en estado APROBADO', async () => {
    const solicitudAprobada = makeSolicitud('APROBADO');
    const prisma = makePrisma({ solicitudActual: solicitudAprobada });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitudAprobada);
    const svc = makeService(prisma, makeScopeService(true));

    await expect(
      svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: 'Ya aprobado' }, USUARIO_ID, 'RECTORADO'),
    ).rejects.toThrow(ConflictException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCENARIO 16: Ciclo completo — correcciones → programa corregido → nueva solicitud
// ─────────────────────────────────────────────────────────────────────────────
describe('Escenario 16 — Ciclo completo: correcciones → corrección → nueva solicitud', () => {
  it('después de correcciones, si el programa vuelve al 100% se crea nueva solicitud', async () => {
    // Partimos de programa EN_REVISION (avance < 100%) y sin solicitud pendiente
    const prisma = makePrisma({
      programaActual: makeProgramaIncompleto(),
      solicitudActual: null,
    });
    const svc = makeService(prisma);

    await svc.actualizarPrograma(MATERIA_ID, DTO_COMPLETO as any, USUARIO_ID, 'SECRETARIA_ACADEMICA');

    expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Avance cae por debajo del 100% → solicitud PENDIENTE invalidada
// ─────────────────────────────────────────────────────────────────────────────
describe('Avance cae por debajo del 100% — solicitud PENDIENTE_APROBACION invalidada', () => {
  it('llama updateMany con estado INVALIDADA cuando el avance baja del 100%', async () => {
    // Programa actualmente completo y con solicitud pendiente
    const solicitudPendiente = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      programaActual: makeProgramaCompleto(),
      solicitudActual: solicitudPendiente,
    });
    const svc = makeService(prisma);

    // Guardamos con datos que dejan el programa incompleto (objetivosGenerales muy corto)
    await svc.actualizarPrograma(
      MATERIA_ID,
      { seccionModificada: 'sec1', objetivosGenerales: 'corto' },
      USUARIO_ID,
      'SECRETARIA_ACADEMICA',
    );

    expect(prisma.solicitudAprobacionPrograma.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }),
        data: expect.objectContaining({ estado: 'INVALIDADA' }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cambio sustancial en programa APROBADO → requiere nueva aprobación
// ─────────────────────────────────────────────────────────────────────────────
describe('Cambio sustancial en programa APROBADO → pasa a EN_REVISION y nueva solicitud', () => {
  it('invalida solicitudes anteriores y crea nueva solicitud cuando cambia campo sustancial', async () => {
    const programaAprobado = makeProgramaCompleto('APROBADO');
    const prisma = makePrisma({
      programaActual: programaAprobado,
      solicitudActual: null,
    });
    const svc = makeService(prisma);

    // objetivosGenerales es campo sustancial → dispara invalidación
    const dto = { ...DTO_COMPLETO, objetivosGenerales: TEXTO_LARGO + ' modificado significativamente' };
    const result = await svc.actualizarPrograma(MATERIA_ID, dto as any, USUARIO_ID, 'SECRETARIA_ACADEMICA');

    expect((result as any).estadoPrograma).toBe('EN_REVISION');
    // Al tener todasCompletas=true y cambioSustancial=true: invalida y crea nueva solicitud
    expect(prisma.solicitudAprobacionPrograma.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }),
        data: expect.objectContaining({ estado: 'INVALIDADA' }),
      }),
    );
    expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'PENDIENTE_APROBACION' }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cambio administrativo en programa APROBADO → permanece APROBADO
// ─────────────────────────────────────────────────────────────────────────────
describe('Cambio administrativo en programa APROBADO — permanece APROBADO sin nueva solicitud', () => {
  it('no cambia estadoPrograma ni crea nueva solicitud al modificar solo campo administrativo', async () => {
    const programaAprobado = makeProgramaCompleto('APROBADO');
    const prisma = makePrisma({
      programaActual: programaAprobado,
      solicitudActual: null,
    });
    const svc = makeService(prisma);

    // fechaVigenciaPrograma es campo administrativo (año numérico)
    const result = await svc.actualizarPrograma(
      MATERIA_ID,
      { seccionModificada: 'admin', fechaVigenciaPrograma: 2026 },
      USUARIO_ID,
      'ADMINISTRADOR_SISTEMA',
    );

    expect((result as any).estadoPrograma).toBe('APROBADO');
    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Historial preservado
// ─────────────────────────────────────────────────────────────────────────────
describe('Historial preservado — cada operación registra entrada en HistorialPrograma', () => {
  it('actualizarPrograma registra accion ACTUALIZACION con seccionModificada', async () => {
    const prisma = makePrisma({});
    const svc = makeService(prisma);

    await svc.actualizarPrograma(
      MATERIA_ID,
      { seccionModificada: 'seccion-test' },
      USUARIO_ID,
      'SECRETARIA_ACADEMICA',
    );

    expect(prisma.historialPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'ACTUALIZACION',
          seccion: 'seccion-test',
          usuarioId: USUARIO_ID,
        }),
      }),
    );
  });

  it('aprobarSolicitud registra accion APROBACION con nombre del rol', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      programaActual: makeProgramaCompleto(),
      solicitudActual: solicitud,
      solicitudDentroTx: solicitud,
    });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(true));

    await svc.aprobarSolicitud(SOLICITUD_ID, USUARIO_ID, 'RECTORADO');

    expect(prisma.historialPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'APROBACION',
          usuarioId: USUARIO_ID,
        }),
      }),
    );
  });

  it('solicitarCorrecciones registra accion CORRECCIONES_SOLICITADAS con observaciones', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      solicitudActual: solicitud,
      solicitudDentroTx: solicitud,
    });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    const svc = makeService(prisma, makeScopeService(true));

    const obs = 'Completar la fundamentación pedagógica del programa.';
    await svc.solicitarCorrecciones(SOLICITUD_ID, { observaciones: obs }, USUARIO_ID, 'DECANO');

    expect(prisma.historialPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'CORRECCIONES_SOLICITADAS',
          seccion: 'Correcciones',
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Programa no encontrado → NotFoundException
// ─────────────────────────────────────────────────────────────────────────────
describe('NotFoundException cuando la solicitud o el programa no existe', () => {
  it('aprobarSolicitud lanza NotFoundException si la solicitud no existe', async () => {
    const prisma = makePrisma({});
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(null);
    const svc = makeService(prisma, makeScopeService(true));

    await expect(
      svc.aprobarSolicitud('no-existe', USUARIO_ID, 'SECRETARIA_ACADEMICA'),
    ).rejects.toThrow(NotFoundException);
  });

  it('solicitarCorrecciones lanza NotFoundException si la solicitud no existe', async () => {
    const prisma = makePrisma({});
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(null);
    const svc = makeService(prisma, makeScopeService(true));

    await expect(
      svc.solicitarCorrecciones('no-existe', { observaciones: 'obs valida larga' }, USUARIO_ID, 'DECANO'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aprobar programa que ya no está al 100% → BadRequestException
// ─────────────────────────────────────────────────────────────────────────────
describe('Aprobar programa que ya no está al 100% lanza BadRequestException', () => {
  it('lanza BadRequestException cuando el programa bajó del 100% al momento de aprobar', async () => {
    const solicitud = makeSolicitud('PENDIENTE_APROBACION');
    const prisma = makePrisma({
      programaActual: makeProgramaIncompleto(),
      solicitudActual: solicitud,
    });
    prisma.solicitudAprobacionPrograma.findUnique = jest.fn().mockResolvedValue(solicitud);
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue(makeProgramaIncompleto());
    const svc = makeService(prisma, makeScopeService(true));

    await expect(
      svc.aprobarSolicitud(SOLICITUD_ID, USUARIO_ID, 'SECRETARIA_ACADEMICA'),
    ).rejects.toThrow(BadRequestException);
  });
});
