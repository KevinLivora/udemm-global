import { ForbiddenException } from '@nestjs/common';
import { ProgramasService } from './programas.service';

/**
 * FASE 3 — Control de acceso a Programas de Asignatura.
 *
 * Roles con permiso de edición:
 *   ADMINISTRADOR_SISTEMA, DIRECTOR_CARRERA, DECANO, SECRETARIA_ACADEMICA, RECTORADO (scope global/institucional)
 *   DOCENTE (solo con vinculación APROBADA a la asignatura — validado en el servicio)
 *
 * ADMINISTRATIVO es solo lectura (bloqueado por RolesGuard).
 */

const MATERIA_A_ID = 'materia-a-id';
const USUARIO_ID   = 'usuario-test-id';
const PROGRAMA_ID  = 'programa-id';
const CARRERA_ID   = 'carrera-test-id';

const MATERIA_A = {
  id: MATERIA_A_ID, codigo: 'MAT001', nombre: 'Materia A', planEstudioId: 'plan-1',
  creditos: 3, estado: 'ACTIVO', anio: 1, cuatrimestre: 1,
  planEstudio: { carreraId: CARRERA_ID },
};

const PROGRAMA_BASE = {
  id: PROGRAMA_ID, materiaId: MATERIA_A_ID, estadoPrograma: 'PENDIENTE',
  estadoS1: 'PENDIENTE', estadoS2: 'PENDIENTE', estadoS3: 'PENDIENTE',
  estadoS4: 'PENDIENTE', estadoS5: 'PENDIENTE', estadoS6: 'PENDIENTE',
  objetivosGenerales: null, aportesPerfilTitulo: null,
  competenciasResultadosJson: null, contenidosGridJson: null,
  unidadesDidacticasJson: null, formacionPracticaJson: null,
  recursosDidacticos: null, metodologiaEnsenanza: null,
  modalidadEvaluacion: null, requisitosAprobacion: null,
  bibliografiaBasica: null, fechaVigenciaPrograma: null, fechaAprobacion: null,
  historial: [],
};

const makePrisma = () => {
  const prisma: any = {
    docente:            { findUnique: jest.fn().mockResolvedValue(null) },
    vinculacionCatedra: { findFirst: jest.fn().mockResolvedValue(null) },
    materia: {
      findUnique: jest.fn().mockResolvedValue(MATERIA_A),
    },
    programaAsignatura: {
      findFirst: jest.fn().mockResolvedValue(PROGRAMA_BASE),
      findUnique: jest.fn().mockResolvedValue({ ...PROGRAMA_BASE, historial: [] }),
      upsert: jest.fn().mockResolvedValue(PROGRAMA_BASE),
    },
    historialPrograma: {
      create: jest.fn().mockResolvedValue({}),
    },
    solicitudAprobacionPrograma: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({ id: 'sol-id' }),
    },
  };
  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  return prisma;
};

const makeScopeService = (tieneScope = true) => ({
  tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope),
});

const makeService = (prisma: any, scopeService?: any) =>
  new ProgramasService(prisma as any, (scopeService ?? makeScopeService()) as any);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProgramasService — control de acceso (FASE 3)', () => {

  describe('SECRETARIA_ACADEMICA — sin consultas de ownership ni scope', () => {
    it('puede editar sin verificar vinculación docente ni scope de carrera', async () => {
      const prisma = makePrisma();
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'SECRETARIA_ACADEMICA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
      expect(scope.tieneScopeCarrera).not.toHaveBeenCalled();
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });
  });

  describe('DIRECTOR_CARRERA — verifica scope de carrera, no consulta docente/vinculacion', () => {
    it('puede editar programa de su carrera asignada', async () => {
      const prisma = makePrisma();
      const scope = makeScopeService(true);
      await makeService(prisma, scope).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA');
      expect(prisma.docente.findUnique).not.toHaveBeenCalled();
      expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(USUARIO_ID, 'DIRECTOR_CARRERA', CARRERA_ID);
    });

    it('recibe 403 al intentar editar programa de carrera fuera de su scope', async () => {
      const prisma = makePrisma();
      const scope = makeScopeService(false);
      await expect(makeService(prisma, scope).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DIRECTOR_CARRERA'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('DOCENTE — autorización por vinculación APROBADA (validado en servicio)', () => {
    const DOCENTE_ID = 'docente-id';

    it('puede editar cuando tiene vinculación APROBADA a la asignatura', async () => {
      const prisma = makePrisma();
      prisma.docente.findUnique.mockResolvedValue({ id: DOCENTE_ID });
      prisma.vinculacionCatedra.findFirst.mockResolvedValue({ id: 'vinc-aprobada-id' });

      await makeService(prisma).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE');

      expect(prisma.docente.findUnique).toHaveBeenCalledWith({
        where: { usuarioId: USUARIO_ID },
        select: { id: true },
      });
      expect(prisma.vinculacionCatedra.findFirst).toHaveBeenCalledWith({
        where: { docenteId: DOCENTE_ID, materiaId: MATERIA_A_ID, estado: 'APROBADA' },
        select: { id: true },
      });
      expect(prisma.programaAsignatura.upsert).toHaveBeenCalled();
    });

    it('lanza 403 cuando no existe perfil docente asociado al usuario', async () => {
      const prisma = makePrisma();
      // docente.findUnique retorna null (valor por defecto del mock)
      await expect(makeService(prisma).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'))
        .rejects.toThrow(ForbiddenException);
      expect(prisma.vinculacionCatedra.findFirst).not.toHaveBeenCalled();
      expect(prisma.programaAsignatura.upsert).not.toHaveBeenCalled();
    });

    it('lanza 403 cuando no tiene vinculación APROBADA con la asignatura', async () => {
      const prisma = makePrisma();
      prisma.docente.findUnique.mockResolvedValue({ id: DOCENTE_ID });
      // vinculacionCatedra.findFirst retorna null (valor por defecto del mock)

      await expect(makeService(prisma).actualizarPrograma(MATERIA_A_ID, {}, USUARIO_ID, 'DOCENTE'))
        .rejects.toThrow(ForbiddenException);
      expect(prisma.programaAsignatura.upsert).not.toHaveBeenCalled();
    });

    it('lanza 403 al intentar editar una asignatura distinta a su vinculación', async () => {
      const OTRA_MATERIA = 'materia-b-id';
      const prisma = makePrisma();
      prisma.materia.findUnique.mockResolvedValue({
        ...MATERIA_A, id: OTRA_MATERIA, planEstudio: { carreraId: CARRERA_ID },
      });
      prisma.docente.findUnique.mockResolvedValue({ id: DOCENTE_ID });
      // vinculacionCatedra.findFirst para OTRA_MATERIA retorna null

      await expect(makeService(prisma).actualizarPrograma(OTRA_MATERIA, {}, USUARIO_ID, 'DOCENTE'))
        .rejects.toThrow(ForbiddenException);
      expect(prisma.vinculacionCatedra.findFirst).toHaveBeenCalledWith({
        where: { docenteId: DOCENTE_ID, materiaId: OTRA_MATERIA, estado: 'APROBADA' },
        select: { id: true },
      });
    });
  });

});
