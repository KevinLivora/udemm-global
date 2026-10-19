import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigFacultadService } from './config-facultad.service';

const FACULTAD_ID = 'fac-01';
const USUARIO_ID  = 'usr-01';

// ── Fixtures ────────────────────────────────────────────────────────────────

const CONFIG_EXISTENTE = {
  id: 'cfg-01',
  facultadId: FACULTAD_ID,
  p01TopeH: 60,
  p02BajaH: 20,
  p03MaxMat: 4,
  updatedAt: new Date(),
  updatedBy: USUARIO_ID,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScope(overrides: Partial<{ getCarrerasEnScope: jest.Mock; tieneScopeCarrera: jest.Mock }> = {}) {
  return {
    getCarrerasEnScope: jest.fn().mockResolvedValue(['car-01']),
    tieneScopeCarrera:  jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  return {
    autoevaluacionConfigFacultad: {
      findUnique: jest.fn().mockResolvedValue(CONFIG_EXISTENTE),
      create:     jest.fn().mockResolvedValue(CONFIG_EXISTENTE),
      update:     jest.fn().mockResolvedValue(CONFIG_EXISTENTE),
    },
    facultad: {
      findUnique: jest.fn().mockResolvedValue({ id: FACULTAD_ID }),
    },
    usuarioFacultad: {
      findFirst: jest.fn().mockResolvedValue({ usuarioId: USUARIO_ID, facultadId: FACULTAD_ID }),
    },
    carrera: {
      findFirst: jest.fn().mockResolvedValue({ id: 'car-01', facultadId: FACULTAD_ID }),
    },
    ...overrides,
  };
}

/** Prisma que simula que NO hay config preexistente (caso creación). */
function makePrismaCreacion(createMock = jest.fn().mockResolvedValue(CONFIG_EXISTENTE)) {
  return makePrisma({
    autoevaluacionConfigFacultad: {
      findUnique: jest.fn().mockResolvedValue(null),
      create:     createMock,
      update:     jest.fn(),
    },
  });
}

const makeService = (prisma: any, scope: any) =>
  new ConfigFacultadService(prisma as any, scope as any);

// ── Tests: obtenerConfig ─────────────────────────────────────────────────────

describe('ConfigFacultadService — obtenerConfig', () => {

  describe('Caso 1: roles globales obtienen config existente', () => {
    it.each(['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO'])(
      'devuelve la config cuando el rol es %s',
      async (rol) => {
        const service = makeService(makePrisma(), makeScope());
        const result = await service.obtenerConfig(FACULTAD_ID, USUARIO_ID, rol);
        expect(result).toEqual(CONFIG_EXISTENTE);
      },
    );
  });

  describe('Caso 2: facultad sin config devuelve null', () => {
    it('devuelve null sin lanzar error cuando no existe configuración', async () => {
      const prisma = makePrisma({
        autoevaluacionConfigFacultad: {
          findUnique: jest.fn().mockResolvedValue(null),
          create:     jest.fn(),
          update:     jest.fn(),
        },
      });
      const service = makeService(prisma, makeScope());
      const result = await service.obtenerConfig(FACULTAD_ID, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(result).toBeNull();
    });
  });

  describe('Caso 3: DECANO sin asociación a la facultad → 403', () => {
    it('lanza ForbiddenException si el DECANO no está asociado a la facultad', async () => {
      const prisma = makePrisma({
        usuarioFacultad: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.obtenerConfig(FACULTAD_ID, USUARIO_ID, 'DECANO'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Caso 4: DIRECTOR_CARRERA sin carrera en la facultad → 403', () => {
    it('lanza ForbiddenException si ninguna carrera del director pertenece a la facultad', async () => {
      const prisma = makePrisma({
        carrera: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      const scope = makeScope({ getCarrerasEnScope: jest.fn().mockResolvedValue(['car-otro']) });
      const service = makeService(prisma, scope);
      await expect(
        service.obtenerConfig(FACULTAD_ID, USUARIO_ID, 'DIRECTOR_CARRERA'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

// ── Tests: upsertConfig ──────────────────────────────────────────────────────

describe('ConfigFacultadService — upsertConfig', () => {

  describe('Caso 5: facultad inexistente → 404', () => {
    it('lanza NotFoundException si la facultad no existe', async () => {
      const prisma = makePrisma({
        facultad: { findUnique: jest.fn().mockResolvedValue(null) },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.upsertConfig(FACULTAD_ID, { p01TopeH: 50, p02BajaH: 10, p03MaxMat: 4 }, USUARIO_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── M-01: los tres parámetros son obligatorios al crear ───────────────────

  describe('Caso 6 (M-01): creación sin p01TopeH → 400', () => {
    it('lanza BadRequestException si falta p01TopeH al crear', async () => {
      const service = makeService(makePrismaCreacion(), makeScope());
      await expect(
        service.upsertConfig(FACULTAD_ID, { p02BajaH: 20, p03MaxMat: 4 }, USUARIO_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Caso 7 (M-01): creación sin p02BajaH → 400', () => {
    it('lanza BadRequestException si falta p02BajaH al crear', async () => {
      const service = makeService(makePrismaCreacion(), makeScope());
      await expect(
        service.upsertConfig(FACULTAD_ID, { p01TopeH: 60, p03MaxMat: 4 }, USUARIO_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Caso 8 (M-01): creación sin p03MaxMat → 400', () => {
    it('lanza BadRequestException si falta p03MaxMat al crear', async () => {
      const service = makeService(makePrismaCreacion(), makeScope());
      await expect(
        service.upsertConfig(FACULTAD_ID, { p01TopeH: 60, p02BajaH: 20 }, USUARIO_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Caso 9 (M-01): creación con los tres parámetros completos → aceptada', () => {
    it('no lanza error y llama a create cuando la creación incluye p01, p02 y p03', async () => {
      const createMock = jest.fn().mockResolvedValue(CONFIG_EXISTENTE);
      const service = makeService(makePrismaCreacion(createMock), makeScope());
      const result = await service.upsertConfig(
        FACULTAD_ID,
        { p01TopeH: 60, p02BajaH: 20, p03MaxMat: 4 },
        USUARIO_ID,
      );
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(CONFIG_EXISTENTE);
    });
  });

  // ── Validación cruzada p02 < p01 ─────────────────────────────────────────

  describe('Caso 10: p02BajaH >= p01TopeH en creación → 400', () => {
    it('lanza BadRequestException si p02BajaH es igual a p01TopeH', async () => {
      const service = makeService(makePrismaCreacion(), makeScope());
      await expect(
        service.upsertConfig(FACULTAD_ID, { p01TopeH: 30, p02BajaH: 30, p03MaxMat: 4 }, USUARIO_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si p02BajaH es mayor que p01TopeH', async () => {
      const service = makeService(makePrismaCreacion(), makeScope());
      await expect(
        service.upsertConfig(FACULTAD_ID, { p01TopeH: 20, p02BajaH: 30, p03MaxMat: 4 }, USUARIO_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Caso 11: validación cruzada usando config existente cuando el DTO es parcial', () => {
    it('usa el p01TopeH almacenado si el DTO solo envía p02BajaH', async () => {
      const prisma = makePrisma({
        autoevaluacionConfigFacultad: {
          findUnique: jest.fn().mockResolvedValue({ ...CONFIG_EXISTENTE, p01TopeH: 60 }),
          create:     jest.fn(),
          update:     jest.fn().mockResolvedValue(CONFIG_EXISTENTE),
        },
      });
      const service = makeService(prisma, makeScope());
      // p02BajaH=55 < p01TopeH=60 → válido
      const result = await service.upsertConfig(FACULTAD_ID, { p02BajaH: 55 }, USUARIO_ID);
      expect(result).toBeDefined();
    });

    it('rechaza si el p02BajaH del DTO supera el p01TopeH almacenado', async () => {
      const prisma = makePrisma({
        autoevaluacionConfigFacultad: {
          findUnique: jest.fn().mockResolvedValue({ ...CONFIG_EXISTENTE, p01TopeH: 40 }),
          create:     jest.fn(),
          update:     jest.fn(),
        },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.upsertConfig(FACULTAD_ID, { p02BajaH: 50 }, USUARIO_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Caso 12 (M-01): actualización parcial con config existente → aceptada', () => {
    it('acepta actualización de solo p01TopeH sin exigir los demás parámetros', async () => {
      const updateMock = jest.fn().mockResolvedValue({ ...CONFIG_EXISTENTE, p01TopeH: 70 });
      const prisma = makePrisma({
        autoevaluacionConfigFacultad: {
          findUnique: jest.fn().mockResolvedValue(CONFIG_EXISTENTE),
          create:     jest.fn(),
          update:     updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      // Solo envía p01TopeH=70; p02BajaH=20 (almacenado) < 70 → válido
      const result = await service.upsertConfig(FACULTAD_ID, { p01TopeH: 70 }, USUARIO_ID);
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });
  });

  describe('Caso 13: create exitoso en la creación inicial', () => {
    it('llama a prisma.create con los valores correctos y retorna la config guardada', async () => {
      const createMock = jest.fn().mockResolvedValue(CONFIG_EXISTENTE);
      const service = makeService(makePrismaCreacion(createMock), makeScope());
      const result = await service.upsertConfig(
        FACULTAD_ID,
        { p01TopeH: 60, p02BajaH: 20, p03MaxMat: 4 },
        USUARIO_ID,
      );

      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ p01TopeH: 60, p02BajaH: 20, p03MaxMat: 4 }),
        }),
      );
      expect(result).toEqual(CONFIG_EXISTENTE);
    });
  });

  // ── Casos de regresión: PATCH parcial en update no debe incluir ramas create ─

  describe('Caso 14 (regresión): PATCH solo p03MaxMat con config existente — bug original', () => {
    it('llama a update con solo p03MaxMat y no incluye p01TopeH ni p02BajaH en data', async () => {
      const cfgActualizada = { ...CONFIG_EXISTENTE, p03MaxMat: 5 };
      const updateMock = jest.fn().mockResolvedValue(cfgActualizada);
      const prisma = makePrisma({
        autoevaluacionConfigFacultad: {
          findUnique: jest.fn().mockResolvedValue(CONFIG_EXISTENTE),
          create:     jest.fn(),
          update:     updateMock,
        },
      });
      const service = makeService(prisma, makeScope());

      const result = await service.upsertConfig(FACULTAD_ID, { p03MaxMat: 5 }, USUARIO_ID);

      expect(updateMock).toHaveBeenCalledTimes(1);
      const updateArgs = updateMock.mock.calls[0][0];
      expect(updateArgs.data).toHaveProperty('p03MaxMat', 5);
      expect(updateArgs.data).not.toHaveProperty('p01TopeH');
      expect(updateArgs.data).not.toHaveProperty('p02BajaH');
      expect(result).toEqual(cfgActualizada);
    });
  });

  describe('Caso 15 (regresión): PATCH solo p01TopeH con config existente', () => {
    it('llama a update con solo p01TopeH y no incluye p02BajaH ni p03MaxMat en data', async () => {
      const cfgActualizada = { ...CONFIG_EXISTENTE, p01TopeH: 80 };
      const updateMock = jest.fn().mockResolvedValue(cfgActualizada);
      const prisma = makePrisma({
        autoevaluacionConfigFacultad: {
          findUnique: jest.fn().mockResolvedValue(CONFIG_EXISTENTE),
          create:     jest.fn(),
          update:     updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      // p02BajaH=20 (almacenado) < p01TopeH=80 (nuevo) → válido
      const result = await service.upsertConfig(FACULTAD_ID, { p01TopeH: 80 }, USUARIO_ID);

      expect(updateMock).toHaveBeenCalledTimes(1);
      const updateArgs = updateMock.mock.calls[0][0];
      expect(updateArgs.data).toHaveProperty('p01TopeH', 80);
      expect(updateArgs.data).not.toHaveProperty('p02BajaH');
      expect(updateArgs.data).not.toHaveProperty('p03MaxMat');
      expect(result).toEqual(cfgActualizada);
    });
  });
});
