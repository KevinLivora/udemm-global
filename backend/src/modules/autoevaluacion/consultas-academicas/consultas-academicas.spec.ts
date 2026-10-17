import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsultasAcademicasService } from './consultas-academicas.service';

// ── Constantes ───────────────────────────────────────────────────────────────

const USR = 'usr-01';
const FAC_ID  = 'fac-01';
const FAC2_ID = 'fac-02';
const CAR_ID  = 'car-01';
const PLAN_ID = 'plan-01';
const MAT_ID  = 'mat-01';
const DOC_ID  = 'doc-01';
const VIN_ID  = 'vin-01';

const ADMIN   = 'ADMINISTRADOR_SISTEMA';
const SECRETA = 'SECRETARIA_ACADEMICA';
const RECTO   = 'RECTORADO';
const DECANO  = 'DECANO';
const DIRECTOR = 'DIRECTOR_CARRERA';
const DOCENTE  = 'DOCENTE';
const ADMVO    = 'ADMINISTRATIVO';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScope({
  carrerasScope = null as string[] | null,
  tieneScope = true,
} = {}) {
  return {
    getCarrerasEnScope: jest.fn().mockResolvedValue(carrerasScope),
    tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope),
  };
}

const FAC_ROW = { id: FAC_ID, nombre: 'Ingeniería', estado: 'ACTIVO', codigo: 'ING' };
const CAR_ROW = { id: CAR_ID, nombre: 'Sistemas', facultadId: FAC_ID, estado: 'ACTIVO', codigo: null };
const PLAN_ROW = {
  id: PLAN_ID, nombre: 'Plan 2020', carreraId: CAR_ID,
  version: '2020', anio: 2020, estado: 'ACTIVO', fechaAprobacion: null,
  horasMinTotales: 2400, horasMinCB: 600, horasMinTB: 800, horasMinTA: 700, horasMinCTX: 300,
};
const DOC_ROW = {
  id: DOC_ID, nombre: 'Ana', apellido: 'García',
  activo: true, dedicacion: 'TIEMPO COMPLETO', categoriaDocente: 'TITULAR',
};

function makeMateria(overrides = {}) {
  return {
    id: MAT_ID, codigo: 'MAT001', nombre: 'Álgebra',
    planEstudioId: PLAN_ID, estado: 'ACTIVO', anio: 1, cuatrimestre: 1,
    bloqueConocimiento: 'CB', cargaHorariaSemanal: 4, cargaHorariaTotal: 64,
    tipoAsignatura: 'OBLIGATORIA',
    ...overrides,
  };
}

function makeVinculacion(overrides = {}) {
  return {
    id: VIN_ID, materiaId: MAT_ID, docenteId: DOC_ID,
    catedraId: 'cat-01', planEstudioId: PLAN_ID, carreraId: CAR_ID,
    estado: 'APROBADA', esResponsableCatedra: null, horasSemana: 4,
    materia: { nombre: 'Álgebra' },
    docente: DOC_ROW,
    ...overrides,
  };
}

function makePrograma(overrides = {}) {
  return {
    id: 'prog-01', materiaId: MAT_ID, estadoPrograma: 'APROBADO',
    estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
    estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
    fechaAprobacion: new Date('2025-01-01'), anioVigencia: 2025,
    ...overrides,
  };
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    facultad: {
      findMany: jest.fn().mockResolvedValue([FAC_ROW]),
    },
    carrera: {
      findMany: jest.fn().mockResolvedValue([CAR_ROW]),
      findFirst: jest.fn().mockResolvedValue(CAR_ROW),
      findUnique: jest.fn().mockResolvedValue(CAR_ROW),
    },
    planEstudio: {
      findMany: jest.fn().mockResolvedValue([PLAN_ROW]),
      findUnique: jest.fn().mockResolvedValue({ carreraId: CAR_ID }),
    },
    materia: {
      findMany: jest.fn().mockResolvedValue([makeMateria()]),
      findUnique: jest.fn().mockResolvedValue({ planEstudio: { carreraId: CAR_ID } }),
    },
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue([makeVinculacion()]),
    },
    programaAsignatura: {
      findUnique: jest.fn().mockResolvedValue(makePrograma()),
    },
    autoevaluacionConfigFacultad: {
      findUnique: jest.fn().mockResolvedValue({
        facultadId: FAC_ID, p01TopeH: 60, p02BajaH: 20,
        p03MaxMat: 4, updatedAt: new Date(),
      }),
    },
    usuarioFacultad: {
      findFirst: jest.fn().mockResolvedValue({ usuarioId: USR, facultadId: FAC_ID }),
    },
    ...overrides,
  };
}

function svc(prisma: any, scope: any) {
  return new ConsultasAcademicasService(prisma as any, scope as any);
}

// ════════════════════════════════════════════════════════════════════════════
// G. SEGURIDAD — RBAC y alcance
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — seguridad y alcance', () => {

  describe('Roles sin acceso a MOD-AUT', () => {
    it('DOCENTE → ForbiddenException en obtenerFacultadesEnScope', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerFacultadesEnScope(USR, DOCENTE))
        .rejects.toThrow(ForbiddenException);
    });

    it('ADMINISTRATIVO → ForbiddenException en obtenerFacultadesEnScope', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerFacultadesEnScope(USR, ADMVO))
        .rejects.toThrow(ForbiddenException);
    });

    it('DOCENTE → ForbiddenException en obtenerMateriasDePlan', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerMateriasDePlan(PLAN_ID, USR, DOCENTE))
        .rejects.toThrow(ForbiddenException);
    });

    it('ADMINISTRATIVO → ForbiddenException en obtenerVinculacionesDePlan', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMVO))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('Roles globales autorizados', () => {
    it.each([ADMIN, SECRETA, RECTO])(
      '%s accede a obtenerFacultadesEnScope sin restricción',
      async (rol) => {
        const result = await svc(makePrisma(), makeScope()).obtenerFacultadesEnScope(USR, rol);
        expect(result).toHaveLength(1);
      },
    );
  });

  describe('DIRECTOR_CARRERA fuera de alcance', () => {
    it('lanza ForbiddenException al consultar una carrera no asignada', async () => {
      const scope = makeScope({ tieneScope: false });
      await expect(svc(makePrisma(), scope).obtenerPlanesDeCarrera(CAR_ID, USR, DIRECTOR))
        .rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException al consultar materias de un plan fuera de alcance', async () => {
      const scope = makeScope({ tieneScope: false });
      await expect(svc(makePrisma(), scope).obtenerMateriasDePlan(PLAN_ID, USR, DIRECTOR))
        .rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException al consultar vinculaciones de un plan fuera de alcance', async () => {
      const scope = makeScope({ tieneScope: false });
      await expect(svc(makePrisma(), scope).obtenerVinculacionesDePlan(PLAN_ID, USR, DIRECTOR))
        .rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException al consultar programa de una materia fuera de alcance', async () => {
      const scope = makeScope({ tieneScope: false });
      await expect(svc(makePrisma(), scope).obtenerProgramaDeMateria(MAT_ID, USR, DIRECTOR))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DECANO limitado a su facultad', () => {
    it('obtenerCarrerasEnScope filtra según las carreras en scope del DECANO', async () => {
      // DECANO tiene scope sobre car-01; car-02 queda fuera
      const scope = makeScope({ carrerasScope: [CAR_ID] });
      const prisma = makePrisma({
        carrera: { findMany: jest.fn().mockResolvedValue([CAR_ROW]) },
      });
      const result = await svc(prisma, scope).obtenerCarrerasEnScope(null, USR, DECANO);
      // Prisma recibió filtro id: { in: [CAR_ID] } — solo se devuelven esas carreras
      expect(prisma.carrera.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { in: [CAR_ID] } }) }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('Intento de acceso por ID fuera de alcance', () => {
    it('obtenerPlanesDeCarrera lanza 403 si tieneScopeCarrera es false', async () => {
      const scope = makeScope({ tieneScope: false });
      await expect(svc(makePrisma(), scope).obtenerPlanesDeCarrera('car-ajena', USR, DIRECTOR))
        .rejects.toThrow(ForbiddenException);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// A. ESTRUCTURA INSTITUCIONAL
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — estructura institucional', () => {

  describe('obtenerFacultadesEnScope', () => {
    it('alcance global → consulta todas las facultades', async () => {
      const result = await svc(makePrisma(), makeScope()).obtenerFacultadesEnScope(USR, ADMIN);
      expect(result).toEqual([FAC_ROW]);
    });

    it('DIRECTOR_CARRERA → devuelve solo las facultades de sus carreras', async () => {
      const scope = makeScope({ carrerasScope: [CAR_ID] });
      const prisma = makePrisma({
        carrera: {
          findMany: jest.fn().mockResolvedValue([
            { facultad: { id: FAC_ID, nombre: 'Ingeniería', estado: 'ACTIVO', codigo: null } },
          ]),
        },
      });
      const result = await svc(prisma, scope).obtenerFacultadesEnScope(USR, DIRECTOR);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(FAC_ID);
    });

    it('scope vacío → array vacío', async () => {
      const scope = makeScope({ carrerasScope: [] });
      const result = await svc(makePrisma(), scope).obtenerFacultadesEnScope(USR, DIRECTOR);
      expect(result).toEqual([]);
    });
  });

  describe('obtenerCarrerasEnScope', () => {
    it('alcance global sin filtro → consulta todas las carreras', async () => {
      const result = await svc(makePrisma(), makeScope()).obtenerCarrerasEnScope(null, USR, ADMIN);
      expect(result).toHaveLength(1);
    });

    it('con filtro de facultad → aplica filtro en where', async () => {
      const prisma = makePrisma();
      await svc(prisma, makeScope()).obtenerCarrerasEnScope(FAC_ID, USR, ADMIN);
      expect(prisma.carrera.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ facultadId: FAC_ID }) }),
      );
    });

    it('DIRECTOR con carrerasScope → aplica filtro id in scope', async () => {
      const scope = makeScope({ carrerasScope: [CAR_ID] });
      const prisma = makePrisma();
      await svc(prisma, scope).obtenerCarrerasEnScope(null, USR, DIRECTOR);
      expect(prisma.carrera.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { in: [CAR_ID] } }) }),
      );
    });
  });

  describe('obtenerPlanesDeCarrera', () => {
    it('devuelve planes con umbrales cuando el usuario tiene scope', async () => {
      const result = await svc(makePrisma(), makeScope()).obtenerPlanesDeCarrera(CAR_ID, USR, ADMIN);
      expect(result).toHaveLength(1);
      expect(result[0].umbrales.horasMinCB).toBe(600);
      expect(result[0].umbrales.horasMinCTX).toBe(300);
    });

    it('umbrales null se conservan en el resultado', async () => {
      const prisma = makePrisma({
        planEstudio: {
          findMany: jest.fn().mockResolvedValue([{
            ...PLAN_ROW,
            horasMinTotales: null, horasMinCB: null, horasMinTB: null,
            horasMinTA: null, horasMinCTX: null,
          }]),
          findUnique: jest.fn(),
        },
      });
      const [plan] = await svc(prisma, makeScope()).obtenerPlanesDeCarrera(CAR_ID, USR, ADMIN);
      expect(plan.umbrales.horasMinCB).toBeNull();
      expect(plan.umbrales.horasMinCTX).toBeNull();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. MATERIAS Y BLOQUES CURRICULARES
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — normalización de bloques', () => {
  let service: ConsultasAcademicasService;

  beforeEach(() => {
    service = svc(makePrisma(), makeScope());
  });

  it('bloque "CB" → normalizado CB', () => {
    expect(service.normalizarBloque('CB')).toBe('CB');
  });

  it('bloque "TB" → normalizado TB', () => {
    expect(service.normalizarBloque('TB')).toBe('TB');
  });

  it('bloque "TA" → normalizado TA', () => {
    expect(service.normalizarBloque('TA')).toBe('TA');
  });

  it('bloque "CTX" → normalizado CX (equivalente al valor canonical)', () => {
    expect(service.normalizarBloque('CTX')).toBe('CX');
  });

  it('bloque "CX" → normalizado CX (convención funcional)', () => {
    expect(service.normalizarBloque('CX')).toBe('CX');
  });

  it('bloque "CTC" → normalizado CX (variante del prototipo HTML)', () => {
    expect(service.normalizarBloque('CTC')).toBe('CX');
  });

  it('bloque null → null (sin bloque asignado)', () => {
    expect(service.normalizarBloque(null)).toBeNull();
  });

  it('bloque con valor desconocido → null (no clasificado, no inventado)', () => {
    expect(service.normalizarBloque('HUMANIDADES')).toBeNull();
    expect(service.normalizarBloque('OTRO')).toBeNull();
  });

  it('bloque con espacios o mayúsculas mixtas → normalizado correctamente', () => {
    expect(service.normalizarBloque('  cb  ')).toBe('CB');
    expect(service.normalizarBloque('cx')).toBe('CX');
    expect(service.normalizarBloque('ctc')).toBe('CX');
  });
});

describe('ConsultasAcademicasService — obtenerMateriasDePlan', () => {

  it('devuelve materias con bloqueConocimientoRaw y bloqueNormalizado', async () => {
    const [mat] = await svc(makePrisma(), makeScope())
      .obtenerMateriasDePlan(PLAN_ID, USR, ADMIN);
    expect(mat.bloqueConocimientoRaw).toBe('CB');
    expect(mat.bloqueNormalizado).toBe('CB');
  });

  it('carga horaria null se preserva — no se convierte en 0', async () => {
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([
        makeMateria({ cargaHorariaSemanal: null, cargaHorariaTotal: null }),
      ]) },
    });
    const [mat] = await svc(prisma, makeScope()).obtenerMateriasDePlan(PLAN_ID, USR, ADMIN);
    expect(mat.cargaHorariaSemanal).toBeNull();
    expect(mat.cargaHorariaTotal).toBeNull();
  });

  it('bloque CX en materia → bloqueNormalizado CX, raw preservado', async () => {
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([
        makeMateria({ bloqueConocimiento: 'CX' }),
      ]) },
    });
    const [mat] = await svc(prisma, makeScope()).obtenerMateriasDePlan(PLAN_ID, USR, ADMIN);
    expect(mat.bloqueConocimientoRaw).toBe('CX');
    expect(mat.bloqueNormalizado).toBe('CX');
  });

  it('bloque desconocido → bloqueNormalizado null, raw preservado', async () => {
    const prisma = makePrisma({
      materia: { findMany: jest.fn().mockResolvedValue([
        makeMateria({ bloqueConocimiento: 'HUMANIDADES' }),
      ]) },
    });
    const [mat] = await svc(prisma, makeScope()).obtenerMateriasDePlan(PLAN_ID, USR, ADMIN);
    expect(mat.bloqueConocimientoRaw).toBe('HUMANIDADES');
    expect(mat.bloqueNormalizado).toBeNull();
  });

  it('plan no encontrado → NotFoundException', async () => {
    const prisma = makePrisma({
      planEstudio: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn() },
    });
    await expect(svc(prisma, makeScope()).obtenerMateriasDePlan(PLAN_ID, USR, ADMIN))
      .rejects.toThrow(NotFoundException);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C y D. DOCENTES Y VINCULACIONES
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — obtenerVinculacionesDePlan', () => {

  describe('estados de vinculación — todos preservados', () => {
    it.each([
      'APROBADA',
      'PENDIENTE_DE_APROBACION',
      'RECHAZADA',
      'DESVINCULADA',
    ])('estado %s incluido en el resultado', async (estado) => {
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
          makeVinculacion({ id: `vin-${estado}`, estado }),
        ]) },
      });
      const result = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(result[0].estado).toBe(estado);
    });
  });

  describe('esResponsableCatedra — todos los valores preservados', () => {
    it('esResponsableCatedra true → preserved', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
          makeVinculacion({ esResponsableCatedra: true }),
        ]) },
      });
      const [v] = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(v.esResponsableCatedra).toBe(true);
    });

    it('esResponsableCatedra false → preserved', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
          makeVinculacion({ esResponsableCatedra: false }),
        ]) },
      });
      const [v] = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(v.esResponsableCatedra).toBe(false);
    });

    it('esResponsableCatedra null → preserved (no se convierte en false)', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
          makeVinculacion({ esResponsableCatedra: null }),
        ]) },
      });
      const [v] = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(v.esResponsableCatedra).toBeNull();
    });

    it('responsable efectivo = APROBADA + esResponsableCatedra=true', async () => {
      // El servicio no filtra; el consumidor elige. Verificamos que ambos campos están accesibles.
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
          makeVinculacion({ estado: 'APROBADA', esResponsableCatedra: true }),
          makeVinculacion({ id: 'vin-02', estado: 'DESVINCULADA', esResponsableCatedra: true }),
        ]) },
      });
      const result = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      const efectivos = result.filter(v => v.estado === 'APROBADA' && v.esResponsableCatedra === true);
      expect(efectivos).toHaveLength(1);
    });
  });

  describe('datos de docente', () => {
    it('dedicación conocida → preservada en docente embebido', async () => {
      const [v] = await svc(makePrisma(), makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(v.docente.dedicacion).toBe('TIEMPO COMPLETO');
    });

    it('dedicación null → null en docente embebido', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
          makeVinculacion({ docente: { ...DOC_ROW, dedicacion: null } }),
        ]) },
      });
      const [v] = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(v.docente.dedicacion).toBeNull();
    });

    it('docente con varias vinculaciones → todas retornadas', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
          makeVinculacion({ id: 'vin-01', materiaId: 'mat-01' }),
          makeVinculacion({ id: 'vin-02', materiaId: 'mat-02' }),
        ]) },
      });
      const result = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(result).toHaveLength(2);
      expect(result.every(v => v.docenteId === DOC_ID)).toBe(true);
    });

    it('plan sin vinculaciones → array vacío (docente sin vinculaciones no aparece)', async () => {
      const prisma = makePrisma({
        vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
      });
      const result = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
      expect(result).toHaveLength(0);
    });
  });

  it('horasSemana null se preserva', async () => {
    const prisma = makePrisma({
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
        makeVinculacion({ horasSemana: null }),
      ]) },
    });
    const [v] = await svc(prisma, makeScope()).obtenerVinculacionesDePlan(PLAN_ID, USR, ADMIN);
    expect(v.horasSemana).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// E. PROGRAMAS DE ASIGNATURA
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — obtenerProgramaDeMateria', () => {

  it('programa existente → retornado con secciones y estado', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerProgramaDeMateria(MAT_ID, USR, ADMIN);
    expect(result).not.toBeNull();
    expect(result!.tienePrograma).toBe(true);
    expect(result!.estadoPrograma).toBe('APROBADO');
    expect(result!.secciones.s1).toBe('COMPLETO');
  });

  it('programa ausente → null (sin lanzar error)', async () => {
    const prisma = makePrisma({
      programaAsignatura: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await svc(prisma, makeScope()).obtenerProgramaDeMateria(MAT_ID, USR, ADMIN);
    expect(result).toBeNull();
  });

  it.each(['PENDIENTE', 'EN_REVISION', 'APROBADO'])(
    'estadoPrograma "%s" → preserved sin modificación',
    async (estado) => {
      const prisma = makePrisma({
        programaAsignatura: { findUnique: jest.fn().mockResolvedValue(
          makePrograma({ estadoPrograma: estado }),
        ) },
      });
      const result = await svc(prisma, makeScope()).obtenerProgramaDeMateria(MAT_ID, USR, ADMIN);
      expect(result!.estadoPrograma).toBe(estado);
    },
  );

  it('secciones PENDIENTE → preserved sin calcular porcentajes', async () => {
    const prisma = makePrisma({
      programaAsignatura: { findUnique: jest.fn().mockResolvedValue(
        makePrograma({
          estadoS1: 'COMPLETO', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
          estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
        }),
      ) },
    });
    const result = await svc(prisma, makeScope()).obtenerProgramaDeMateria(MAT_ID, USR, ADMIN);
    expect(result!.secciones.s1).toBe('COMPLETO');
    expect(result!.secciones.s2).toBe('PENDIENTE');
    // No hay campo de porcentaje en el resultado
    expect(result).not.toHaveProperty('porcentaje');
    expect(result).not.toHaveProperty('avance');
  });

  it('materia no encontrada → NotFoundException', async () => {
    const prisma = makePrisma({
      materia: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(svc(prisma, makeScope()).obtenerProgramaDeMateria(MAT_ID, USR, ADMIN))
      .rejects.toThrow(NotFoundException);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// F. CONFIGURACIONES
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — obtenerConfigAut', () => {

  describe('roles globales autorizados', () => {
    it.each([ADMIN, SECRETA, RECTO])(
      '%s accede a obtenerConfigAut sin restricción de scope',
      async (rol) => {
        const result = await svc(makePrisma(), makeScope()).obtenerConfigAut(FAC_ID, USR, rol);
        expect(result).not.toBeNull();
        expect(result!.p01TopeH).toBe(60);
        expect(result!.p02BajaH).toBe(20);
        expect(result!.p03MaxMat).toBe(4);
      },
    );
  });

  describe('DECANO', () => {
    it('DECANO con asociación a la facultad → config retornada', async () => {
      const result = await svc(makePrisma(), makeScope()).obtenerConfigAut(FAC_ID, USR, DECANO);
      expect(result).not.toBeNull();
      expect(result!.p01TopeH).toBe(60);
    });

    it('DECANO sin asociación a la facultad → ForbiddenException', async () => {
      const prisma = makePrisma({
        usuarioFacultad: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      await expect(svc(prisma, makeScope()).obtenerConfigAut(FAC_ID, USR, DECANO))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DIRECTOR_CARRERA', () => {
    it('DIRECTOR con carrera en la facultad → config retornada', async () => {
      // carrera.findFirst default devuelve CAR_ROW con facultadId: FAC_ID → autorizado
      const scope = makeScope({ carrerasScope: [CAR_ID] });
      const result = await svc(makePrisma(), scope).obtenerConfigAut(FAC_ID, USR, DIRECTOR);
      expect(result).not.toBeNull();
    });

    it('DIRECTOR sin carrera en la facultad → ForbiddenException', async () => {
      const scope = makeScope({ carrerasScope: [CAR_ID] });
      const prisma = makePrisma({
        carrera: {
          findMany: jest.fn().mockResolvedValue([CAR_ROW]),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      });
      await expect(svc(prisma, scope).obtenerConfigAut(FAC_ID, USR, DIRECTOR))
        .rejects.toThrow(ForbiddenException);
    });

    it('DIRECTOR sin carreras en scope → ForbiddenException', async () => {
      const scope = makeScope({ carrerasScope: [] });
      await expect(svc(makePrisma(), scope).obtenerConfigAut(FAC_ID, USR, DIRECTOR))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('roles sin acceso a MOD-AUT', () => {
    it('DOCENTE → ForbiddenException', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerConfigAut(FAC_ID, USR, DOCENTE))
        .rejects.toThrow(ForbiddenException);
    });

    it('ADMINISTRATIVO → ForbiddenException', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerConfigAut(FAC_ID, USR, ADMVO))
        .rejects.toThrow(ForbiddenException);
    });
  });

  it('facultad autorizada sin configuración → null', async () => {
    const prisma = makePrisma({
      autoevaluacionConfigFacultad: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await svc(prisma, makeScope()).obtenerConfigAut(FAC_ID, USR, ADMIN);
    expect(result).toBeNull();
  });

  it('no se consulta Prisma autoevaluacionConfigFacultad cuando falla la autorización', async () => {
    const prisma = makePrisma();
    await expect(svc(prisma, makeScope()).obtenerConfigAut(FAC_ID, USR, DOCENTE))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.autoevaluacionConfigFacultad.findUnique).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// H. VINCULACIONES POR CARRERA (R-06)
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — obtenerVinculacionesDeCarrera', () => {

  describe('roles sin acceso a MOD-AUT', () => {
    it('DOCENTE → ForbiddenException', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, DOCENTE))
        .rejects.toThrow(ForbiddenException);
    });

    it('ADMINISTRATIVO → ForbiddenException', async () => {
      await expect(svc(makePrisma(), makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, ADMVO))
        .rejects.toThrow(ForbiddenException);
    });
  });

  it('carrera no encontrada → NotFoundException', async () => {
    const prisma = makePrisma({
      carrera: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(svc(prisma, makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, ADMIN))
      .rejects.toThrow(NotFoundException);
  });

  it('sin scope → ForbiddenException', async () => {
    const scope = makeScope({ tieneScope: false });
    await expect(svc(makePrisma(), scope).obtenerVinculacionesDeCarrera(CAR_ID, USR, DIRECTOR))
      .rejects.toThrow(ForbiddenException);
  });

  it('devuelve vinculaciones de la carrera con docente embebido', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, ADMIN);
    expect(result).toHaveLength(1);
    expect(result[0].carreraId).toBe(CAR_ID);
    expect(result[0].docente.nombre).toBe('Ana');
    expect(result[0].docente.apellido).toBe('García');
  });

  it('consulta Prisma con where: { carreraId }', async () => {
    const prisma = makePrisma();
    await svc(prisma, makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, ADMIN);
    expect(prisma.vinculacionCatedra.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { carreraId: CAR_ID } }),
    );
  });

  it('todos los estados de vinculación se preservan', async () => {
    const prisma = makePrisma({
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([
        makeVinculacion({ estado: 'PENDIENTE_DE_APROBACION' }),
      ]) },
    });
    const result = await svc(prisma, makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, ADMIN);
    expect(result[0].estado).toBe('PENDIENTE_DE_APROBACION');
  });

  it('carrera vacía (sin vinculaciones) → array vacío', async () => {
    const prisma = makePrisma({
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const result = await svc(prisma, makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, ADMIN);
    expect(result).toHaveLength(0);
  });

  it('no se consultan vinculaciones cuando falla la autorización de rol', async () => {
    const prisma = makePrisma();
    await expect(svc(prisma, makeScope()).obtenerVinculacionesDeCarrera(CAR_ID, USR, DOCENTE))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.vinculacionCatedra.findMany).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// I. obtenerConfigDeCarrera
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — obtenerConfigDeCarrera', () => {

  const CONFIG_ROW = { facultadId: FAC_ID, p01TopeH: 60, p02BajaH: 20, p03MaxMat: 4, updatedAt: new Date() };

  it('DOCENTE → ForbiddenException antes de consultar config', async () => {
    const prisma = makePrisma();
    await expect(svc(prisma, makeScope()).obtenerConfigDeCarrera(CAR_ID, USR, DOCENTE))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.autoevaluacionConfigFacultad.findUnique).not.toHaveBeenCalled();
  });

  it('ADMINISTRATIVO → ForbiddenException antes de consultar config', async () => {
    const prisma = makePrisma();
    await expect(svc(prisma, makeScope()).obtenerConfigDeCarrera(CAR_ID, USR, ADMVO))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.autoevaluacionConfigFacultad.findUnique).not.toHaveBeenCalled();
  });

  it('carrera inexistente → NotFoundException', async () => {
    const prisma = makePrisma({ carrera: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(svc(prisma, makeScope()).obtenerConfigDeCarrera(CAR_ID, USR, ADMIN))
      .rejects.toThrow(NotFoundException);
  });

  it('sin scope de carrera → ForbiddenException', async () => {
    await expect(svc(makePrisma(), makeScope({ tieneScope: false })).obtenerConfigDeCarrera(CAR_ID, USR, DIRECTOR))
      .rejects.toThrow(ForbiddenException);
  });

  it('devuelve config cuando la facultad tiene configuración', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerConfigDeCarrera(CAR_ID, USR, ADMIN);
    expect(result).not.toBeNull();
    expect(result!.p03MaxMat).toBe(4);
    expect(result!.p01TopeH).toBe(60);
  });

  it('devuelve null cuando la facultad no tiene config MOD-AUT', async () => {
    const prisma = makePrisma({
      autoevaluacionConfigFacultad: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const result = await svc(prisma, makeScope()).obtenerConfigDeCarrera(CAR_ID, USR, ADMIN);
    expect(result).toBeNull();
  });

  it('busca la config por la facultadId derivada de la carrera', async () => {
    const prisma = makePrisma();
    await svc(prisma, makeScope()).obtenerConfigDeCarrera(CAR_ID, USR, ADMIN);
    expect(prisma.autoevaluacionConfigFacultad.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { facultadId: FAC_ID } }),
    );
  });

  it('DIRECTOR con scope en la carrera puede obtener la config', async () => {
    const result = await svc(makePrisma(), makeScope({ tieneScope: true, carrerasScope: [CAR_ID] })).obtenerConfigDeCarrera(CAR_ID, USR, DIRECTOR);
    expect(result).not.toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// J. obtenerVinculacionesParaR07 + detectarDocentesMultiFacultad
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — obtenerVinculacionesParaR07', () => {

  it('ADMINISTRADOR_SISTEMA: consulta por facultadId (alcance completo)', async () => {
    const prisma = makePrisma();
    await svc(prisma, makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(prisma.vinculacionCatedra.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { facultadId: FAC_ID } }),
    );
  });

  it('SECRETARIA_ACADEMICA: consulta por facultadId, alcanceFacultad=true', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, SECRETA);
    expect(result.alcanceFacultad).toBe(true);
    expect(result.facultadId).toBe(FAC_ID);
  });

  it('RECTORADO: consulta por facultadId, alcanceFacultad=true', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, RECTO);
    expect(result.alcanceFacultad).toBe(true);
  });

  it('DECANO: consulta por facultadId, alcanceFacultad=true', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, DECANO);
    expect(result.alcanceFacultad).toBe(true);
  });

  it('DIRECTOR_CARRERA: consulta por carreraId (alcance limitado), alcanceFacultad=false', async () => {
    const prisma = makePrisma();
    const result = await svc(prisma, makeScope({ tieneScope: true })).obtenerVinculacionesParaR07(CAR_ID, USR, DIRECTOR);
    expect(result.alcanceFacultad).toBe(false);
    expect(prisma.vinculacionCatedra.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { carreraId: CAR_ID } }),
    );
  });

  it('carreraId inexistente → NotFoundException', async () => {
    const prisma = makePrisma({ carrera: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(svc(prisma, makeScope()).obtenerVinculacionesParaR07('car-x', USR, ADMIN))
      .rejects.toThrow(NotFoundException);
  });

  it('sin scope de carrera → ForbiddenException', async () => {
    await expect(svc(makePrisma(), makeScope({ tieneScope: false })).obtenerVinculacionesParaR07(CAR_ID, USR, DIRECTOR))
      .rejects.toThrow(ForbiddenException);
  });

  it('DOCENTE rechazado → ForbiddenException', async () => {
    await expect(svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, DOCENTE))
      .rejects.toThrow(ForbiddenException);
  });

  it('ADMINISTRATIVO rechazado → ForbiddenException', async () => {
    await expect(svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMVO))
      .rejects.toThrow(ForbiddenException);
  });

  it('resultado mapea correctamente las vinculaciones retornadas por Prisma', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(result.vinculaciones).toHaveLength(1);
    const v = result.vinculaciones[0];
    expect(v.docenteId).toBe(DOC_ID);
    expect(v.estado).toBe('APROBADA');
    expect(v.docente.nombre).toBe('Ana');
  });

  it('resultado incluye facultadId de la carrera', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(result.facultadId).toBe(FAC_ID);
  });

  it('resultado incluye docentesMultiFacultad como Set', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(result.docentesMultiFacultad).toBeInstanceOf(Set);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// J.2 detectarDocentesMultiFacultad — comportamiento interno (vía obtenerVinculacionesParaR07)
// ════════════════════════════════════════════════════════════════════════════

describe('ConsultasAcademicasService — detección multi-facultad (comportamiento interno)', () => {

  it('sin vinculaciones en el scope: docentesMultiFacultad vacío, sin consulta adicional', async () => {
    const prisma = makePrisma({
      vinculacionCatedra: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const result = await svc(prisma, makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(result.docentesMultiFacultad.size).toBe(0);
    // Sin docenteIds, no se ejecuta la consulta de detección
    expect(prisma.vinculacionCatedra.findMany).toHaveBeenCalledTimes(1);
  });

  it('ADMIN: detecta docente con vinculaciones APROBADAS en otra facultad', async () => {
    const prisma = makePrisma({
      vinculacionCatedra: {
        findMany: jest.fn()
          .mockResolvedValueOnce([makeVinculacion({ docenteId: 'doc-cross' })])
          .mockResolvedValueOnce([{ docenteId: 'doc-cross' }]),
      },
    });
    const result = await svc(prisma, makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(result.docentesMultiFacultad.has('doc-cross')).toBe(true);
  });

  it('ADMIN: docente sin vinculaciones en otras facultades: no en docentesMultiFacultad', async () => {
    const prisma = makePrisma({
      vinculacionCatedra: {
        findMany: jest.fn()
          .mockResolvedValueOnce([makeVinculacion()])
          .mockResolvedValueOnce([]),
      },
    });
    const result = await svc(prisma, makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(result.docentesMultiFacultad.has(DOC_ID)).toBe(false);
    expect(result.docentesMultiFacultad.size).toBe(0);
  });

  it('ADMIN: la detección interna filtra por estado APROBADA y facultadId distinta', async () => {
    const prisma = makePrisma();
    await svc(prisma, makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    const calls = (prisma.vinculacionCatedra.findMany as jest.Mock).mock.calls;
    const detectionCall = calls.find((args: any[]) => args[0]?.where?.facultadId?.not !== undefined);
    expect(detectionCall).toBeDefined();
    expect(detectionCall![0]).toMatchObject({
      where: expect.objectContaining({
        estado: 'APROBADA',
        facultadId: { not: FAC_ID },
      }),
    });
  });

  it('DIRECTOR_CARRERA: docentesMultiFacultad vacío sin consulta adicional (alcance parcial)', async () => {
    const prisma = makePrisma();
    const result = await svc(prisma, makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, DIRECTOR);
    expect(result.docentesMultiFacultad.size).toBe(0);
    expect(prisma.vinculacionCatedra.findMany).toHaveBeenCalledTimes(1);
  });

  it('docentesMultiFacultad es un Set', async () => {
    const result = await svc(makePrisma(), makeScope()).obtenerVinculacionesParaR07(CAR_ID, USR, ADMIN);
    expect(result.docentesMultiFacultad).toBeInstanceOf(Set);
  });

});
