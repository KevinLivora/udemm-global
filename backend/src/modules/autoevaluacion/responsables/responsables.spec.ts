import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ResponsablesService } from './responsables.service';

const VIN_ID     = 'vin-01';
const MATERIA_ID = 'mat-01';
const CATEDRA_ID = 'cat-01';
const CARRERA_ID = 'car-01';
const USUARIO_ID = 'usr-01';
const DOCENTE_ID = 'doc-01';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VIN_BASE = {
  id: VIN_ID,
  estado: 'APROBADA',
  carreraId: CARRERA_ID,
  materiaId: MATERIA_ID,
  catedraId: CATEDRA_ID,
  docenteId: DOCENTE_ID,
  esResponsableCatedra: null,
};

const VIN_UPDATED = {
  id: VIN_ID,
  docenteId: DOCENTE_ID,
  materiaId: MATERIA_ID,
  catedraId: CATEDRA_ID,
  carreraId: CARRERA_ID,
  planEstudioId: 'plan-01',
  esResponsableCatedra: true,
  estado: 'APROBADA',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScope(tieneScope = true) {
  return { tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope) };
}

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  return {
    vinculacionCatedra: {
      findUnique:  jest.fn().mockResolvedValue(VIN_BASE),
      findFirst:   jest.fn().mockResolvedValue(null), // sin responsable APROBADO existente
      update:      jest.fn().mockResolvedValue(VIN_UPDATED),
    },
    materia: {
      findUnique: jest.fn().mockResolvedValue({
        id: MATERIA_ID,
        planEstudio: { carreraId: CARRERA_ID },
      }),
    },
    ...overrides,
  };
}

const makeService = (prisma: any, scope: any) =>
  new ResponsablesService(prisma as any, scope as any);

// ── Tests: designarResponsable ────────────────────────────────────────────────

describe('ResponsablesService — designarResponsable', () => {

  describe('Caso 1: vinculación no encontrada → 404', () => {
    it('lanza NotFoundException si la vinculacion no existe', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), update: jest.fn() },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Caso 2: vinculación no APROBADA → 422', () => {
    it('lanza UnprocessableEntityException si el estado no es APROBADA', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue({ ...VIN_BASE, estado: 'PENDIENTE_DE_APROBACION' }),
          findFirst:  jest.fn(),
          update:     jest.fn(),
        },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA'),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('Caso 3: DIRECTOR_CARRERA sin scope → 403', () => {
    it('lanza ForbiddenException si el director no tiene scope sobre la carrera', async () => {
      const service = makeService(makePrisma(), makeScope(false));
      await expect(
        service.designarResponsable(VIN_ID, true, USUARIO_ID, 'DIRECTOR_CARRERA'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Caso 4 (H-01): responsable APROBADO ya existe → 409', () => {
    it('lanza ConflictException si ya hay un responsable APROBADO para la misma (materia, cátedra)', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue(VIN_BASE),
          findFirst:  jest.fn().mockResolvedValue({ id: 'vin-otro', docenteId: 'doc-otro' }),
          update:     jest.fn(),
        },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA'),
      ).rejects.toThrow(ConflictException);
    });

    it('la consulta de conflicto incluye estado=APROBADA', async () => {
      const findFirstMock = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue(VIN_BASE),
          findFirst:  findFirstMock,
          update:     jest.fn().mockResolvedValue(VIN_UPDATED),
        },
      });
      const service = makeService(prisma, makeScope());
      await service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');

      expect(findFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'APROBADA' }),
        }),
      );
    });
  });

  describe('Caso 5 (H-01): vinculación DESVINCULADA con responsable=true no bloquea nueva designación', () => {
    it('permite designar responsable aunque exista una vinculación DESVINCULADA con esResponsableCatedra=true', async () => {
      // findFirst devuelve null porque filtra por estado=APROBADA:
      // la vinculación DESVINCULADA queda fuera del filtro y no bloquea.
      const findFirstMock = jest.fn().mockResolvedValue(null);
      const updateMock = jest.fn().mockResolvedValue(VIN_UPDATED);
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue(VIN_BASE),
          findFirst:  findFirstMock,
          update:     updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      const result = await service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');

      expect(result.esResponsableCatedra).toBe(true);
      expect(updateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Caso 6 (H-01): vinculación RECHAZADA con responsable=true no bloquea', () => {
    it('permite designar aunque exista RECHAZADA con esResponsableCatedra=true', async () => {
      const service = makeService(makePrisma(), makeScope()); // findFirst → null (solo APROBADA)
      const result = await service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(result.esResponsableCatedra).toBe(true);
    });
  });

  describe('Caso 7 (H-01): vinculación PENDIENTE con responsable=true no bloquea', () => {
    it('permite designar aunque exista PENDIENTE con esResponsableCatedra=true', async () => {
      const service = makeService(makePrisma(), makeScope()); // findFirst → null (solo APROBADA)
      const result = await service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(result.esResponsableCatedra).toBe(true);
    });
  });

  describe('Caso 8: quitar responsable (esResponsable=false) no verifica conflicto', () => {
    it('actualiza esResponsableCatedra=false sin consultar conflictos', async () => {
      const updateMock = jest.fn().mockResolvedValue({ ...VIN_UPDATED, esResponsableCatedra: false });
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue({ ...VIN_BASE, esResponsableCatedra: true }),
          findFirst:  jest.fn(),
          update:     updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      await service.designarResponsable(VIN_ID, false, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');

      expect(prisma.vinculacionCatedra.findFirst).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { esResponsableCatedra: false } }),
      );
    });
  });

  describe('Caso 9: designación exitosa para ADMINISTRADOR_SISTEMA', () => {
    it('retorna la vinculacion con esResponsableCatedra=true', async () => {
      const service = makeService(makePrisma(), makeScope());
      const result = await service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(result.esResponsableCatedra).toBe(true);
    });
  });

  describe('Caso 10: DIRECTOR_CARRERA con scope válido designa responsable', () => {
    it('completa la operación cuando el director tiene scope', async () => {
      const result = await makeService(makePrisma(), makeScope(true))
        .designarResponsable(VIN_ID, true, USUARIO_ID, 'DIRECTOR_CARRERA');
      expect(result).toBeDefined();
    });
  });

  describe('Caso 11 (H-02): error P2002 de PostgreSQL → 409', () => {
    it('convierte PrismaClientKnownRequestError P2002 en ConflictException', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: {} },
      );
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue(VIN_BASE),
          findFirst:  jest.fn().mockResolvedValue(null),
          update:     jest.fn().mockRejectedValue(p2002),
        },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Caso 12 (H-02): otros errores de Prisma no se convierten en 409', () => {
    it('propaga PrismaClientKnownRequestError con código distinto de P2002', async () => {
      const otroError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0', meta: {} },
      );
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue(VIN_BASE),
          findFirst:  jest.fn().mockResolvedValue(null),
          update:     jest.fn().mockRejectedValue(otroError),
        },
      });
      const service = makeService(prisma, makeScope());
      // debe lanzar el error original, NO un ConflictException
      await expect(
        service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA'),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });

    it('propaga errores genéricos sin conversión', async () => {
      const errorGenerico = new Error('Connection lost');
      const prisma = makePrisma({
        vinculacionCatedra: {
          findUnique: jest.fn().mockResolvedValue(VIN_BASE),
          findFirst:  jest.fn().mockResolvedValue(null),
          update:     jest.fn().mockRejectedValue(errorGenerico),
        },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.designarResponsable(VIN_ID, true, USUARIO_ID, 'ADMINISTRADOR_SISTEMA'),
      ).rejects.toThrow('Connection lost');
    });
  });
});

// ── Tests: obtenerResponsable ─────────────────────────────────────────────────

describe('ResponsablesService — obtenerResponsable', () => {

  describe('Caso 13: materia no encontrada → 404', () => {
    it('lanza NotFoundException si la materia no existe', async () => {
      const prisma = makePrisma({ materia: { findUnique: jest.fn().mockResolvedValue(null) } });
      const service = makeService(prisma, makeScope());
      await expect(
        service.obtenerResponsable(MATERIA_ID, CATEDRA_ID, USUARIO_ID, 'DIRECTOR_CARRERA'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Caso 14: usuario sin scope → 403', () => {
    it('lanza ForbiddenException si el usuario no tiene scope sobre la carrera', async () => {
      const service = makeService(makePrisma(), makeScope(false));
      await expect(
        service.obtenerResponsable(MATERIA_ID, CATEDRA_ID, USUARIO_ID, 'DIRECTOR_CARRERA'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Caso 15: sin responsable activo → null', () => {
    it('devuelve null si no hay ningún responsable APROBADO', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      });
      const service = makeService(prisma, makeScope());
      const result = await service.obtenerResponsable(MATERIA_ID, CATEDRA_ID, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(result).toBeNull();
    });
  });

  describe('Caso 16: responsable encontrado', () => {
    it('devuelve el responsable con datos del docente', async () => {
      const RESPONSABLE = {
        id: VIN_ID,
        docenteId: DOCENTE_ID,
        docente: { nombre: 'ANA', apellido: 'GARCIA' },
        materiaId: MATERIA_ID,
        catedraId: CATEDRA_ID,
        estado: 'APROBADA',
      };
      const prisma = makePrisma({
        vinculacionCatedra: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(RESPONSABLE), update: jest.fn() },
      });
      const result = await makeService(prisma, makeScope())
        .obtenerResponsable(MATERIA_ID, CATEDRA_ID, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(result).toEqual(RESPONSABLE);
    });
  });
});
