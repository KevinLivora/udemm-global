import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { ProgramasService } from './programas.service';
import { ProgramasController } from './programas.controller';
import { GenerarRegularizacionDto } from './dto/generar-regularizacion.dto';

/**
 * Tests C16.2 — Endpoint POST /programas/regularizacion/generar
 *
 * Genera solicitudes de aprobación para programas históricos al 100%
 * que no tienen SolicitudAprobacionPrograma activa.
 *
 * Escenarios cubiertos (12):
 *
 *   1.  Programa completo sin solicitud → resultado GENERADA
 *   2.  Programa incompleto → OMITIDO (pre-check)
 *   3.  Programa aprobado → OMITIDO (pre-check)
 *   4.  Programa con correcciones activas → OMITIDO (pre-check)
 *   5.  Programa con solicitud pendiente → OMITIDO con solicitudId (pre-check)
 *   6.  Ejecución repetida → segunda ejecución OMITIDO (idempotencia pre-check)
 *   7.  Concurrencia: in-tx findFirst detecta solicitud creada entre pre-check y tx → OMITIDO
 *   8.  Notificaciones: notificacion.create llamado para directivo con scope
 *   9.  Historial: historialPrograma.create con accion REGULARIZACION_HISTORICA
 *   10. Usuario sin permisos: endpoint decorado solo con ADMINISTRADOR_SISTEMA y SECRETARIA_ACADEMICA
 *   11. Programa inexistente → NotFoundException
 *   12. Fallo transaccional → solicitudAprobacionPrograma.create no persiste
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const U_ID        = 'usuario-regulariz-id';
const PROG_ID     = 'prog-c162-id';
const MATERIA_ID  = 'materia-c162-id';
const NUEVA_SOL   = 'nueva-sol-c162-id';
const TEXTO_LARGO = 'x'.repeat(55);

function makeProgramaCompleto(overrides: Record<string, any> = {}) {
  return {
    id: PROG_ID, materiaId: MATERIA_ID, estadoPrograma: 'EN_REVISION',
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
    materia: { id: MATERIA_ID, nombre: 'Investigación Operativa I', codigo: 'IND-201' },
    solicitudes: [],
    ...overrides,
  };
}

function makeProgramaIncompleto() {
  return {
    id: PROG_ID, materiaId: MATERIA_ID, estadoPrograma: 'PENDIENTE',
    estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
    estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
    objetivosGenerales: null, aportesPerfilTitulo: null,
    competenciasResultadosJson: null, contenidosGridJson: null,
    unidadesDidacticasJson: null, actividadesFormacionPractica: null,
    formacionPracticaJson: null, recursosDidacticos: null,
    metodologiaEnsenanza: null, modalidadEvaluacion: null,
    requisitosAprobacion: null, bibliografiaBasica: null,
    fechaVigenciaPrograma: null, fechaAprobacion: null,
    materia: { id: MATERIA_ID, nombre: 'Investigación Operativa I', codigo: 'IND-201' },
    solicitudes: [],
  };
}

interface PrismaOpts {
  programaFindUnique?: any;
  solicitudFindFirstTx?: any;   // resultado del findFirst dentro de la transacción
  programaFindUniqueTx?: any;   // resultado del findUnique dentro de la transacción
  transactionThrows?: boolean;
  directivos?: any[];
}

function makePrisma(opts: PrismaOpts = {}) {
  const progCompleto = makeProgramaCompleto();

  const findUniqueProg = opts.programaFindUnique !== undefined
    ? opts.programaFindUnique
    : progCompleto;

  const findUniqueTx = opts.programaFindUniqueTx !== undefined
    ? opts.programaFindUniqueTx
    : progCompleto;

  const solFindFirstTx = opts.solicitudFindFirstTx !== undefined
    ? opts.solicitudFindFirstTx
    : null;

  const directivos = opts.directivos ?? [
    {
      id: 'directivo-id', activo: true,
      rol: { nombre: 'SECRETARIA_ACADEMICA' },
      carrerasAsociadas: [],
      facultadesAsociadas: [],
    },
  ];

  const prisma: any = {
    materia: {
      findUnique: jest.fn().mockResolvedValue({
        id: MATERIA_ID, nombre: 'Investigación Operativa I',
        planEstudio: {
          carreraId: 'carrera-id', nombre: 'Plan 2006',
          carrera: {
            id: 'carrera-id', nombre: 'Ing. Industrial',
            facultad: { id: 'facultad-id', nombre: 'Fac. Ingeniería' },
          },
        },
      }),
    },
    programaAsignatura: {
      findUnique: jest.fn().mockResolvedValue(findUniqueTx),
      findFirst:  jest.fn().mockResolvedValue(null),
      upsert:     jest.fn().mockResolvedValue(progCompleto),
      update:     jest.fn().mockResolvedValue(progCompleto),
      findMany:   jest.fn().mockResolvedValue([]),
    },
    solicitudAprobacionPrograma: {
      findFirst:  jest.fn().mockResolvedValue(solFindFirstTx),
      findMany:   jest.fn().mockResolvedValue([]),
      create:     jest.fn().mockResolvedValue({ id: NUEVA_SOL, estado: 'PENDIENTE_APROBACION' }),
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
      findUnique: jest.fn().mockResolvedValue({ nombre: 'Admin', apellido: 'Test' }),
      findMany:   jest.fn().mockResolvedValue(directivos),
    },
    notificacion: {
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    mensajeCorrecionPrograma: {
      findMany: jest.fn().mockResolvedValue([]),
      count:    jest.fn().mockResolvedValue(0),
    },
    docente: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  // $queryRaw: mock del SELECT ... FOR UPDATE (C16.3 — bloqueo de fila en PostgreSQL)
  prisma.$queryRaw = jest.fn().mockResolvedValue([{ id: PROG_ID }]);

  if (opts.transactionThrows) {
    prisma.$transaction = jest.fn().mockRejectedValue(new Error('DB error'));
  } else {
    prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  }

  // Override findUnique para el primer nivel (el include con solicitudes es lo que
  // se usa en la carga inicial del programa antes del tx)
  prisma.programaAsignatura.findUnique = jest.fn().mockImplementation((args: any) => {
    if (args?.where?.id === PROG_ID) {
      return Promise.resolve(findUniqueProg);
    }
    return Promise.resolve(findUniqueTx);
  });

  return prisma;
}

function makeService(prisma: any) {
  const scopeService = {
    tieneScopeCarrera:  jest.fn().mockResolvedValue(true),
    getCarrerasEnScope: jest.fn().mockResolvedValue(null),
  };
  return new ProgramasService(prisma as any, scopeService as any);
}

function makeDto(programaIds: string[]): GenerarRegularizacionDto {
  return { programaIds } as GenerarRegularizacionDto;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests 1–12
// ─────────────────────────────────────────────────────────────────────────────

describe('C16.2 — generarSolicitudesRegularizacion', () => {

  // 1. Programa completo sin solicitud → GENERADA
  test('1. Programa 100% sin solicitud activa → resultado GENERADA y solicitudId presente', async () => {
    const prisma = makePrisma();
    const svc    = makeService(prisma);

    const result = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    expect(result.procesados).toBe(1);
    expect(result.solicitudesGeneradas).toBe(1);
    expect(result.omitidos).toBe(0);
    expect(result.detalle[0].resultado).toBe('GENERADA');
    expect(result.detalle[0].solicitudId).toBe(NUEVA_SOL);
    expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ programaId: PROG_ID, estado: 'PENDIENTE_APROBACION' }) })
    );
  });

  // 2. Programa incompleto → OMITIDO
  test('2. Programa con secciones incompletas → OMITIDO antes de la transacción', async () => {
    const prisma = makePrisma({ programaFindUnique: makeProgramaIncompleto() });
    const svc    = makeService(prisma);

    const result = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    expect(result.solicitudesGeneradas).toBe(0);
    expect(result.detalle[0].resultado).toBe('OMITIDO');
    expect(result.detalle[0].motivoOmision).toMatch(/completo al 100%/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // 3. Programa aprobado → OMITIDO
  test('3. Programa con estadoPrograma=APROBADO → OMITIDO antes de la transacción', async () => {
    const prisma = makePrisma({
      programaFindUnique: makeProgramaCompleto({ estadoPrograma: 'APROBADO' }),
    });
    const svc = makeService(prisma);

    const result = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    expect(result.solicitudesGeneradas).toBe(0);
    expect(result.detalle[0].resultado).toBe('OMITIDO');
    expect(result.detalle[0].motivoOmision).toMatch(/aprobado/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // 4. Programa con correcciones activas → OMITIDO
  test('4. Programa con CORRECCIONES_SOLICITADAS activas → OMITIDO', async () => {
    const solicActiva = { id: 'sol-corr', estado: 'CORRECCIONES_SOLICITADAS' };
    const prisma = makePrisma({
      programaFindUnique: makeProgramaCompleto({ solicitudes: [solicActiva] }),
    });
    const svc = makeService(prisma);

    const result = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    expect(result.detalle[0].resultado).toBe('OMITIDO');
    expect(result.detalle[0].motivoOmision).toMatch(/correcciones/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // 5. Programa con solicitud pendiente → OMITIDO con solicitudId
  test('5. Programa con PENDIENTE_APROBACION existente → OMITIDO con solicitudId del existente', async () => {
    const solicActiva = { id: 'sol-pend', estado: 'PENDIENTE_APROBACION' };
    const prisma = makePrisma({
      programaFindUnique: makeProgramaCompleto({ solicitudes: [solicActiva] }),
    });
    const svc = makeService(prisma);

    const result = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    expect(result.detalle[0].resultado).toBe('OMITIDO');
    expect(result.detalle[0].solicitudId).toBe('sol-pend');
    expect(result.detalle[0].motivoOmision).toMatch(/PENDIENTE_APROBACION/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // 6. Ejecución repetida → segunda ejecución OMITIDO (idempotencia)
  test('6. Segunda ejecución sobre el mismo programa → OMITIDO (idempotencia)', async () => {
    const prisma = makePrisma();
    const svc    = makeService(prisma);

    // Primera ejecución: sin solicitud activa → GENERADA
    const r1 = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);
    expect(r1.detalle[0].resultado).toBe('GENERADA');

    // Simular que ahora el programa ya tiene la solicitud recién creada
    const solicGenerada = { id: NUEVA_SOL, estado: 'PENDIENTE_APROBACION' };
    prisma.programaAsignatura.findUnique = jest.fn().mockResolvedValue(
      makeProgramaCompleto({ solicitudes: [solicGenerada] }),
    );

    // Segunda ejecución: solicitud ya presente → OMITIDO
    const r2 = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);
    expect(r2.detalle[0].resultado).toBe('OMITIDO');
    expect(r2.detalle[0].solicitudId).toBe(NUEVA_SOL);

    // create solo fue llamado en la primera ejecución
    expect(prisma.solicitudAprobacionPrograma.create).toHaveBeenCalledTimes(1);
  });

  // 7. Concurrencia: in-tx findFirst detecta solicitud creada entre pre-check y tx
  test('7. Solicitud creada concurrentemente entre pre-check y transacción → OMITIDO (no duplica)', async () => {
    // Pre-check: programa sin solicitud activa (pasa el pre-check)
    // Dentro de tx: findFirst retorna solicitud existente (race condition detectado)
    const solicCreada = { id: 'sol-concurrente', estado: 'PENDIENTE_APROBACION' };
    const prisma = makePrisma({
      programaFindUnique: makeProgramaCompleto({ solicitudes: [] }),
      solicitudFindFirstTx: solicCreada,  // in-tx check encuentra solicitud
    });
    const svc = makeService(prisma);

    const result = await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    expect(result.detalle[0].resultado).toBe('OMITIDO');
    expect(result.detalle[0].motivoOmision).toMatch(/concurrentement/i);
    // create NO fue llamado
    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });

  // 8. Notificaciones a directivos con scope
  test('8. Se generan notificaciones para directivos con scope autorizado', async () => {
    const directivos = [
      { id: 'sec-id', activo: true, rol: { nombre: 'SECRETARIA_ACADEMICA' }, carrerasAsociadas: [], facultadesAsociadas: [] },
      { id: 'rec-id', activo: true, rol: { nombre: 'RECTORADO' },            carrerasAsociadas: [], facultadesAsociadas: [] },
    ];
    const prisma = makePrisma({ directivos });
    const svc    = makeService(prisma);

    await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    // Una notificación por cada directivo con scope
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(2);
    expect(prisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'NUEVA_SOLICITUD_APROBACION',
          usuarioId: 'sec-id',
          solicitudProgramaId: NUEVA_SOL,
        }),
      }),
    );
  });

  // 9. Historial institucional con accion REGULARIZACION_HISTORICA
  test('9. Se registra el evento de regularización en HistorialPrograma', async () => {
    const prisma = makePrisma();
    const svc    = makeService(prisma);

    await svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID);

    expect(prisma.historialPrograma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          programaId:  PROG_ID,
          usuarioId:   U_ID,
          accion:      'REGULARIZACION_HISTORICA',
          descripcion: expect.stringContaining(NUEVA_SOL),
        }),
      }),
    );
  });

  // 10. Usuario sin permisos: endpoint decorado solo con ADMIN_SISTEMA y SECRETARIA_ACADEMICA
  test('10. El endpoint POST regularizacion/generar está restringido a ADMINISTRADOR_SISTEMA y SECRETARIA_ACADEMICA', () => {
    const controller = new ProgramasController({} as any);
    const roles: string[] = Reflect.getMetadata(
      'roles',
      controller.generarSolicitudesRegularizacion,
    );
    expect(roles).toEqual(expect.arrayContaining(['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA']));
    expect(roles).not.toContain('DOCENTE');
    expect(roles).not.toContain('DIRECTOR_CARRERA');
    expect(roles).not.toContain('DECANO');
  });

  // 11. Programa inexistente → NotFoundException
  test('11. programaId inexistente → NotFoundException sin crear solicitudes', async () => {
    const prisma = makePrisma({ programaFindUnique: null });
    const svc    = makeService(prisma);

    await expect(
      svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });

  // 12. Fallo transaccional → solicitud no persiste
  test('12. Fallo durante la transacción → error propagado y solicitud no persiste', async () => {
    const prisma = makePrisma({ transactionThrows: true });
    const svc    = makeService(prisma);

    await expect(
      svc.generarSolicitudesRegularizacion(makeDto([PROG_ID]), U_ID),
    ).rejects.toThrow('DB error');

    // La transacción falló antes de poder crear; create no se llamó fuera de la tx
    expect(prisma.solicitudAprobacionPrograma.create).not.toHaveBeenCalled();
  });

});
