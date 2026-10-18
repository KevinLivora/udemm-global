import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TablroCarreraService } from './tablero-carrera.service';
import { EstadoCalculo } from '../types/estado-calculo.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAR_ID = 'car-00000000-0000-0000-0000-000000000001';

type CargoPair = { docenteId: string; cargoId: string; cargo: { nombre: string } };

function makePrisma(overrides: {
  carrera?: { id: string } | null;
  planes?: { id: string }[];
  totalMaterias?: number;
  materiasCubiertasIds?: { materiaId: string }[];
  cargosVigentes?: CargoPair[];
} = {}) {
  const {
    carrera = { id: CAR_ID },
    planes = [{ id: 'plan-1' }],
    totalMaterias = 10,
    materiasCubiertasIds = [{ materiaId: 'm-1' }, { materiaId: 'm-2' }],
    cargosVigentes = [],
  } = overrides;

  return {
    carrera: { findUnique: jest.fn().mockResolvedValue(carrera) },
    planEstudio: { findMany: jest.fn().mockResolvedValue(planes) },
    materia: { count: jest.fn().mockResolvedValue(totalMaterias) },
    vinculacionCatedra: {
      findMany: jest.fn().mockImplementation((args: { distinct?: string[] }) => {
        if (Array.isArray(args.distinct) && args.distinct.includes('materiaId')) {
          return Promise.resolve(materiasCubiertasIds);
        }
        return Promise.resolve(cargosVigentes);
      }),
    },
  };
}

function makeScope(tieneScope = true) {
  return { tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope) };
}

function makeSvc(
  prismaOverrides: Parameters<typeof makePrisma>[0] = {},
  scopeValue = true,
) {
  return new TablroCarreraService(
    makePrisma(prismaOverrides) as any,
    makeScope(scopeValue) as any,
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

  describe('estadoGeneralCalculo y estructura de respuesta', () => {
    it('estadoGeneralCalculo es NO_APLICA cuando ambos indicadores son NO_APLICA', async () => {
      const res = await makeSvc({
        planes: [],
        materiasCubiertasIds: [],
        cargosVigentes: [],
      }).consultarCarrera(CAR_ID, USR.usuarioId, USR.rolNombre);
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('estadoGeneralCalculo es CALCULADO cuando ambos indicadores son CALCULADO', async () => {
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
});
