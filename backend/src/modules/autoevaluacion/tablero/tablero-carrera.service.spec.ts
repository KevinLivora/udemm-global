import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TablroCarreraService } from './tablero-carrera.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoR06 } from '../indicadores/r06.evaluador';
import type { ResultadoR07 } from '../indicadores/r07.evaluador';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAR_ID = 'car-00000000-0000-0000-0000-000000000001';

type DocenteId = { docenteId: string };
type CargoPair = { docenteId: string; cargoId: string; cargo: { nombre: string } };

function makePrisma(overrides: {
  carrera?: { id: string } | null;
  planes?: { id: string }[];
  totalMaterias?: number;
  materiasCubiertasIds?: { materiaId: string }[];
  docentesVigentesIds?: DocenteId[];
  cargosActivosConCategoria?: CargoPair[];
  cargosVigentes?: CargoPair[];
} = {}) {
  const {
    carrera = { id: CAR_ID },
    planes = [{ id: 'plan-1' }],
    totalMaterias = 10,
    materiasCubiertasIds = [{ materiaId: 'm-1' }, { materiaId: 'm-2' }],
    docentesVigentesIds = [{ docenteId: 'd-1' }],
    cargosActivosConCategoria = [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
    cargosVigentes = [],
  } = overrides;

  return {
    carrera: { findUnique: jest.fn().mockResolvedValue(carrera) },
    planEstudio: { findMany: jest.fn().mockResolvedValue(planes) },
    materia: { count: jest.fn().mockResolvedValue(totalMaterias) },
    vinculacionCatedra: {
      findMany: jest.fn().mockImplementation((args: any) => {
        const distinct = (args.distinct ?? []) as string[];
        const hasDocenteActivo = args.where?.docente?.activo === true;

        if (distinct.includes('materiaId')) return Promise.resolve(materiasCubiertasIds);
        if (!distinct.includes('cargoId'))  return Promise.resolve(docentesVigentesIds);   // IP-01
        if (hasDocenteActivo)               return Promise.resolve(cargosActivosConCategoria); // IP-02
        return Promise.resolve(cargosVigentes); // IP-08
      }),
    },
  };
}

function makeScope(tieneScope = true) {
  return { tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope) };
}

/** Crea un mock de R06EvaluadorService con resultado controlable. */
function makeR06Mock(estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO) {
  const tieneData = estadoCalculo === EstadoCalculo.CALCULADO;
  const valor: ResultadoR06 = {
    carreraId: CAR_ID,
    totalDocentes: tieneData ? 2 : 0,
    promedio: tieneData ? 2.0 : null,
    mediana: tieneData ? 2.0 : null,
    maximo: tieneData ? 3 : null,
    distribucion: tieneData
      ? [
          { docenteId: 'd-1', nombre: 'Doc Uno', nMaterias: 3 },
          { docenteId: 'd-2', nombre: 'Doc Dos', nMaterias: 1 },
        ]
      : [],
  };
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-06',
      contextoId: CAR_ID,
      tipoContexto: 'CARRERA' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor,
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

/** Crea un mock de R07EvaluadorService con resultado controlable. */
function makeR07Mock(
  estadoCalculo: EstadoCalculo = EstadoCalculo.CALCULADO,
  options: { sobreasignados?: number; alcanceFacultad?: boolean; noDeterminables?: number } = {},
) {
  const { sobreasignados: nSobre = 0, alcanceFacultad = true, noDeterminables = 0 } = options;
  const limite = estadoCalculo === EstadoCalculo.NO_DETERMINABLE ? null : 3;
  const totalDocentes = estadoCalculo === EstadoCalculo.NO_APLICA ? 0 : 2;
  const valor: ResultadoR07 = {
    carreraId: CAR_ID,
    facultadId: 'fac-01',
    limite,
    totalDocentes,
    totalSobreasignados: nSobre,
    sobreasignados: Array.from({ length: nSobre }, (_, i) => ({
      docenteId: `d-over-${i + 1}`,
      nombre: `Sobreasignado ${i + 1}`,
      nMaterias: (limite ?? 3) + i + 1,
      exceso: i + 1,
      asignaciones: [],
    })),
    totalNoDeterminables: noDeterminables,
    noDeterminables: [],
    alcanceFacultad,
  };
  return {
    evaluar: jest.fn().mockResolvedValue({
      codigo: 'R-07',
      contextoId: CAR_ID,
      tipoContexto: 'DOCENTE' as const,
      estadoImplementacion: 'IMPLEMENTADO' as const,
      estadoCalculo,
      valor,
      datosFaltantes: [],
      fechaEvaluacion: new Date(),
    }),
  };
}

function makeSvc(
  prismaOverrides: Parameters<typeof makePrisma>[0] = {},
  scopeValue = true,
  r06Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  r07Estado: EstadoCalculo = EstadoCalculo.CALCULADO,
  r07Options: { sobreasignados?: number; alcanceFacultad?: boolean; noDeterminables?: number } = {},
) {
  return new TablroCarreraService(
    makePrisma(prismaOverrides) as any,
    makeScope(scopeValue) as any,
    makeR06Mock(r06Estado) as any,
    makeR07Mock(r07Estado, r07Options) as any,
  );
}

const USR = { usuarioId: 'usr-1', rolNombre: 'SECRETARIA_ACADEMICA' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TablroCarreraService', () => {
  describe('consultarCarrera — autorización', () => {
    it('lanza ForbiddenException para rol sin acceso a MOD-AUT', async () => {
      await expect(
        makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, 'DOCENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si la carrera no existe', async () => {
      await expect(
        makeSvc({ carrera: null }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el usuario no tiene scope sobre la carrera', async () => {
      await expect(
        makeSvc({}, false).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('IP-03 — Materias cubiertas', () => {
    it('NO_APLICA cuando la carrera no tiene planes de estudio', async () => {
      const res = await makeSvc({ planes: [], materiasCubiertasIds: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip03.total).toBe(0);
      expect(res.ip03.cubiertas).toBe(0);
    });

    it('NO_APLICA cuando los planes no tienen materias', async () => {
      const res = await makeSvc({ totalMaterias: 0, materiasCubiertasIds: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('CALCULADO con conteo correcto de cubiertas y total', async () => {
      const res = await makeSvc({
        totalMaterias: 10,
        materiasCubiertasIds: [{ materiaId: 'm-1' }, { materiaId: 'm-2' }, { materiaId: 'm-3' }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip03.cubiertas).toBe(3);
      expect(res.ip03.total).toBe(10);
    });

    it('cubiertas puede ser 0 aunque existan materias (ninguna con vinculación APROBADA)', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip03.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip03.cubiertas).toBe(0);
      expect(res.ip03.total).toBe(5);
    });
  });

  describe('IP-08 — Relación profesores / auxiliares', () => {
    it('NO_APLICA cuando no hay vinculaciones APROBADAS', async () => {
      const res = await makeSvc({ cargosVigentes: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip08.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip08.ratio).toBeNull();
    });

    it('ratio null cuando auxiliares = 0 (solo profesores)', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip08.profesores).toBe(2);
      expect(res.ip08.auxiliares).toBe(0);
      expect(res.ip08.ratio).toBeNull();
    });

    it('CALCULADO con ratio P/A correcto (2 profesores, 1 auxiliar → 2.0)', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Adjunto' } },
          { docenteId: 'd-3', cargoId: 'c-3', cargo: { nombre: 'JTP' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.profesores).toBe(2);
      expect(res.ip08.auxiliares).toBe(1);
      expect(res.ip08.ratio).toBe(2.0);
    });

    it('cargos de categoría Otros no se cuentan en el ratio', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Coordinador' } },
          { docenteId: 'd-3', cargoId: 'c-3', cargo: { nombre: 'JTP' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.profesores).toBe(1);
      expect(res.ip08.auxiliares).toBe(1);
    });

    it('reconoce variantes de nombre: Profesor Asociado y Ayudante No Graduado', async () => {
      const res = await makeSvc({
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Profesor Asociado' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Ayudante No Graduado' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip08.profesores).toBe(1);
      expect(res.ip08.auxiliares).toBe(1);
      expect(res.ip08.ratio).toBe(1.0);
    });
  });

  describe('IP-01 — Docentes vigentes', () => {
    it('NO_APLICA cuando no hay docentes activos con vinculación APROBADA', async () => {
      const res = await makeSvc({ docentesVigentesIds: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip01.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip01.total).toBe(0);
    });

    it('CALCULADO con conteo correcto de docentes distintos', async () => {
      const res = await makeSvc({
        docentesVigentesIds: [{ docenteId: 'd-1' }, { docenteId: 'd-2' }, { docenteId: 'd-3' }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip01.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip01.total).toBe(3);
    });
  });

  describe('IP-02 — Cargos docentes vigentes', () => {
    it('NO_APLICA cuando no hay cargos docentes clasificables', async () => {
      const res = await makeSvc({ cargosActivosConCategoria: [] }).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip02.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip02.total).toBe(0);
    });

    it('CALCULADO con conteo correcto de cargos P+A', async () => {
      const res = await makeSvc({
        cargosActivosConCategoria: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-1', cargoId: 'c-2', cargo: { nombre: 'JTP' } },
          { docenteId: 'd-2', cargoId: 'c-1', cargo: { nombre: 'Adjunto' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip02.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip02.total).toBe(3);
    });

    it('cargos de gestión ("Otros") no se cuentan en IP-02', async () => {
      const res = await makeSvc({
        cargosActivosConCategoria: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'Coordinador' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip02.total).toBe(1);
    });

    it('NO_APLICA cuando solo hay cargos de gestión', async () => {
      const res = await makeSvc({
        cargosActivosConCategoria: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Director de Carrera' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip02.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    });
  });

  describe('estadoGeneralCalculo y estructura de respuesta', () => {
    it('estadoGeneralCalculo es NO_APLICA cuando todos los indicadores son NO_APLICA', async () => {
      const res = await makeSvc(
        {
          planes: [],
          materiasCubiertasIds: [],
          docentesVigentesIds: [],
          cargosActivosConCategoria: [],
          cargosVigentes: [],
        },
        true,
        EstadoCalculo.NO_APLICA,  // IP-04 (r06)
        EstadoCalculo.NO_APLICA,  // IP-13 (r07)
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('estadoGeneralCalculo es CALCULADO cuando todos los indicadores son CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          { docenteId: 'd-2', cargoId: 'c-2', cargo: { nombre: 'JTP' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('fechaEvaluacion es un string ISO 8601 válido', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.fechaEvaluacion).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(res.fechaEvaluacion).toISOString()).toBe(res.fechaEvaluacion);
    });
  });

  // ── IP-13 — Docentes sobreasignados ──────────────────────────────────────────

  describe('IP-13 — Docentes sobreasignados', () => {
    it('CALCULADO sin sobreasignados: totalSobreasignados=0, sobreasignados vacío', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip13.totalSobreasignados).toBe(0);
      expect(res.ip13.sobreasignados).toEqual([]);
      expect(res.ip13.alcanceFacultad).toBe(true);
    });

    it('CALCULADO con sobreasignados: retorna lista con docenteId, nombre, nMaterias, exceso', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.CALCULADO, { sobreasignados: 2 })
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip13.totalSobreasignados).toBe(2);
      expect(res.ip13.sobreasignados).toHaveLength(2);
      expect(res.ip13.sobreasignados[0]).toMatchObject({
        docenteId: 'd-over-1',
        nombre: 'Sobreasignado 1',
        nMaterias: expect.any(Number),
        exceso: expect.any(Number),
      });
    });

    it('limite refleja el valor de P-03 configurado', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.limite).toBe(3);
    });

    it('NO_APLICA: totalDocentes=0, sobreasignados vacío, limite presente', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.NO_APLICA)
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip13.totalDocentes).toBe(0);
      expect(res.ip13.sobreasignados).toEqual([]);
    });

    it('NO_DETERMINABLE: limite null cuando P-03 no está configurado', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.NO_DETERMINABLE)
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      expect(res.ip13.limite).toBeNull();
      expect(res.ip13.sobreasignados).toEqual([]);
    });

    it('PARCIAL por alcance: alcanceFacultad=false (DIRECTOR_CARRERA)', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.PARCIAL, { alcanceFacultad: false })
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.ip13.alcanceFacultad).toBe(false);
    });

    it('PARCIAL por datos cross-facultad: totalNoDeterminables > 0', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.CALCULADO, EstadoCalculo.PARCIAL, { noDeterminables: 1 })
        .consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.ip13.totalNoDeterminables).toBe(1);
    });

    it('R-07 es invocado con carreraId, usuarioId y rolNombre del contexto', async () => {
      const r07Mock = makeR07Mock();
      const svc = new TablroCarreraService(
        makePrisma() as any,
        makeScope() as any,
        makeR06Mock() as any,
        r07Mock as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(r07Mock.evaluar).toHaveBeenCalledWith(
        expect.objectContaining({
          carreraId: CAR_ID,
          usuarioId: USR.usuarioId,
          rolNombre: USR.rolNombre,
        }),
      );
    });

    it('estadoGeneralCalculo incluye IP-13: todos CALCULADO → CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('estadoGeneralCalculo incluye IP-13: IP-13 PARCIAL eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
        },
        true,
        EstadoCalculo.CALCULADO,
        EstadoCalculo.PARCIAL,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      // PARCIAL (peso 3) > CALCULADO (peso 1) → estadoGeneralCalculo = PARCIAL
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.PARCIAL);
    });

    it('estadoGeneralCalculo incluye IP-13: IP-13 NO_DETERMINABLE eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [{ docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } }],
        },
        true,
        EstadoCalculo.CALCULADO,
        EstadoCalculo.NO_DETERMINABLE,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip13.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      // NO_DETERMINABLE (peso 4) > CALCULADO (peso 1) → estadoGeneralCalculo = NO_DETERMINABLE
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });
  });

  // ── IP-04 — Materias por docente ─────────────────────────────────────────────

  describe('IP-04 — Materias por docente', () => {
    it('CALCULADO: retorna totalDocentes, mediana, promedio y máximo del resultado R-06', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.ip04.totalDocentes).toBe(2);
      expect(res.ip04.mediana).toBe(2.0);
      expect(res.ip04.promedio).toBe(2.0);
      expect(res.ip04.maximo).toBe(3);
    });

    it('NO_APLICA: stats null y distribución vacía cuando R-06 retorna NO_APLICA', async () => {
      const res = await makeSvc({}, true, EstadoCalculo.NO_APLICA).consultarCarrera(
        CAR_ID, USR.usuarioId, USR.rolNombre,
      );
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.ip04.totalDocentes).toBe(0);
      expect(res.ip04.mediana).toBeNull();
      expect(res.ip04.promedio).toBeNull();
      expect(res.ip04.maximo).toBeNull();
      expect(res.ip04.distribucion).toEqual([]);
    });

    it('distribucion refleja el resultado de R-06 sin transformaciones', async () => {
      const res = await makeSvc().consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.distribucion).toHaveLength(2);
      expect(res.ip04.distribucion[0]).toMatchObject({ docenteId: 'd-1', nombre: 'Doc Uno', nMaterias: 3 });
      expect(res.ip04.distribucion[1]).toMatchObject({ docenteId: 'd-2', nombre: 'Doc Dos', nMaterias: 1 });
    });

    it('R-06 es invocado con carreraId, usuarioId y rolNombre del contexto', async () => {
      const r06Mock = makeR06Mock();
      const svc = new TablroCarreraService(
        makePrisma() as any,
        makeScope() as any,
        r06Mock as any,
        makeR07Mock() as any,
      );
      await svc.consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(r06Mock.evaluar).toHaveBeenCalledWith(
        expect.objectContaining({
          carreraId: CAR_ID,
          usuarioId: USR.usuarioId,
          rolNombre: USR.rolNombre,
        }),
      );
    });

    it('estadoGeneralCalculo incluye IP-04: todos CALCULADO → CALCULADO', async () => {
      const res = await makeSvc({
        totalMaterias: 5,
        materiasCubiertasIds: [{ materiaId: 'm-1' }],
        cargosVigentes: [
          { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
        ],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('estadoGeneralCalculo incluye IP-04: IP-04 NO_APLICA eleva el estado general', async () => {
      const res = await makeSvc(
        {
          totalMaterias: 5,
          materiasCubiertasIds: [{ materiaId: 'm-1' }],
          cargosVigentes: [
            { docenteId: 'd-1', cargoId: 'c-1', cargo: { nombre: 'Titular' } },
          ],
        },
        true,
        EstadoCalculo.NO_APLICA,
      ).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.ip04.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      // NO_APLICA (peso 2) > CALCULADO (peso 1) → estadoGeneralCalculo = NO_APLICA
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
    });
  });
});
