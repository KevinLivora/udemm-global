import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import type {
  BloqueNormalizado,
  CarreraAut,
  ConfigFacultadAut,
  EstadoSeccion,
  FacultadAut,
  MateriaAut,
  PlanEstudioAut,
  ProgramaAut,
  UmbralesAut,
  VinculacionAut,
  VinculacionesParaR07,
} from './consultas-academicas.types';

/**
 * Roles habilitados para acceder a MOD-AUT.
 * ADMINISTRATIVO queda excluido aunque ScopeService lo trate como global.
 */
const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

@Injectable()
export class ConsultasAcademicasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  // ── helpers privados ──────────────────────────────────────────────────────

  private checkRol(rolNombre: string): void {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a MOD-AUT');
    }
  }

  /**
   * Normaliza el valor libre de bloqueConocimiento a los cuatro bloques
   * reconocidos por MOD-AUT. El valor original se conserva en bloqueConocimientoRaw.
   *
   * Mapeo:
   *   "CB"                 → 'CB'
   *   "TB"                 → 'TB'
   *   "TA"                 → 'TA'
   *   "CX" / "CTX" / "CTC" → 'CX'  (Ciencias y Tecnologías Complementarias)
   *   null o desconocido   → null   (dato no clasificado, no se inventa)
   */
  normalizarBloque(bloqueConocimiento: string | null | undefined): BloqueNormalizado {
    if (!bloqueConocimiento) return null;
    const v = bloqueConocimiento.trim().toUpperCase();
    if (v === 'CB') return 'CB';
    if (v === 'TB') return 'TB';
    if (v === 'TA') return 'TA';
    if (v === 'CTX' || v === 'CX' || v === 'CTC') return 'CX';
    return null;
  }

  private async verificarScopeFacultad(
    facultadId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<void> {
    const GLOBALES = new Set(['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO']);
    if (GLOBALES.has(rolNombre)) return;

    if (rolNombre === 'DECANO') {
      const asoc = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId, facultadId },
      });
      if (!asoc) throw new ForbiddenException();
      return;
    }

    if (rolNombre === 'DIRECTOR_CARRERA') {
      const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
      if (!carrerasScope || carrerasScope.length === 0) throw new ForbiddenException();
      const carreraEnFacultad = await this.prisma.carrera.findFirst({
        where: { id: { in: carrerasScope }, facultadId },
      });
      if (!carreraEnFacultad) throw new ForbiddenException();
      return;
    }

    throw new ForbiddenException();
  }

  private mapUmbrales(p: {
    horasMinTotales: number | null;
    horasMinCB: number | null;
    horasMinTB: number | null;
    horasMinTA: number | null;
    horasMinCTX: number | null;
  }): UmbralesAut {
    return {
      horasMinTotales: p.horasMinTotales,
      horasMinCB: p.horasMinCB,
      horasMinTB: p.horasMinTB,
      horasMinTA: p.horasMinTA,
      horasMinCTX: p.horasMinCTX,
    };
  }

  // ── Estructura institucional ──────────────────────────────────────────────

  /**
   * Devuelve las facultades accesibles según el alcance del usuario.
   * - Global: todas las facultades.
   * - DECANO/DIRECTOR_CARRERA: solo las facultades de sus carreras.
   */
  async obtenerFacultadesEnScope(
    usuarioId: string,
    rolNombre: string,
  ): Promise<FacultadAut[]> {
    this.checkRol(rolNombre);

    const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);

    if (carrerasScope === null) {
      return this.prisma.facultad.findMany({
        select: { id: true, nombre: true, estado: true, codigo: true },
        orderBy: { nombre: 'asc' },
      });
    }

    if (carrerasScope.length === 0) return [];

    const carreras = await this.prisma.carrera.findMany({
      where: { id: { in: carrerasScope } },
      select: { facultad: { select: { id: true, nombre: true, estado: true, codigo: true } } },
    });

    const seen = new Set<string>();
    const result: FacultadAut[] = [];
    for (const c of carreras) {
      if (!seen.has(c.facultad.id)) {
        seen.add(c.facultad.id);
        result.push(c.facultad);
      }
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * Devuelve las carreras accesibles en el alcance del usuario,
   * opcionalmente filtradas por facultad.
   */
  async obtenerCarrerasEnScope(
    facultadId: string | null,
    usuarioId: string,
    rolNombre: string,
  ): Promise<CarreraAut[]> {
    this.checkRol(rolNombre);

    const carrerasScope = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);

    const where: Record<string, unknown> = {};
    if (facultadId) where['facultadId'] = facultadId;
    if (carrerasScope !== null) where['id'] = { in: carrerasScope };

    return this.prisma.carrera.findMany({
      where,
      select: { id: true, nombre: true, facultadId: true, estado: true, codigo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Devuelve todos los planes de una carrera autorizada,
   * incluyendo sus umbrales horarios configurados.
   */
  async obtenerPlanesDeCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<PlanEstudioAut[]> {
    this.checkRol(rolNombre);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const planes = await this.prisma.planEstudio.findMany({
      where: { carreraId },
      select: {
        id: true, nombre: true, carreraId: true, version: true, anio: true,
        estado: true, fechaAprobacion: true,
        horasMinTotales: true, horasMinCB: true, horasMinTB: true,
        horasMinTA: true, horasMinCTX: true,
      },
      orderBy: [{ anio: 'desc' }, { nombre: 'asc' }],
    });

    return planes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      carreraId: p.carreraId,
      version: p.version,
      anio: p.anio,
      estado: p.estado,
      fechaAprobacion: p.fechaAprobacion,
      umbrales: this.mapUmbrales(p),
    }));
  }

  // ── Materias y bloques curriculares ───────────────────────────────────────

  /**
   * Devuelve las materias de un plan con bloque normalizado.
   * Las cargas horarias NULL se conservan sin conversión.
   */
  async obtenerMateriasDePlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<MateriaAut[]> {
    this.checkRol(rolNombre);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { carreraId: true },
    });
    if (!plan) throw new NotFoundException(`Plan ${planEstudioId} no encontrado`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, plan.carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const materias = await this.prisma.materia.findMany({
      where: { planEstudioId },
      select: {
        id: true, codigo: true, nombre: true, planEstudioId: true, estado: true,
        anio: true, cuatrimestre: true, bloqueConocimiento: true,
        cargaHorariaSemanal: true, cargaHorariaTotal: true, tipoAsignatura: true,
      },
      orderBy: [{ anio: 'asc' }, { cuatrimestre: 'asc' }, { nombre: 'asc' }],
    });

    return materias.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      nombre: m.nombre,
      planEstudioId: m.planEstudioId,
      estado: m.estado,
      anio: m.anio,
      cuatrimestre: m.cuatrimestre,
      bloqueConocimientoRaw: m.bloqueConocimiento,
      bloqueNormalizado: this.normalizarBloque(m.bloqueConocimiento),
      cargaHorariaSemanal: m.cargaHorariaSemanal,
      cargaHorariaTotal: m.cargaHorariaTotal,
      tipoAsignatura: m.tipoAsignatura,
    }));
  }

  // ── Vinculaciones y docentes ──────────────────────────────────────────────

  /**
   * Devuelve todas las vinculaciones de un plan con datos del docente embebidos.
   * Se incluyen todos los estados (APROBADA, PENDIENTE, RECHAZADA, DESVINCULADA).
   * esResponsableCatedra null se conserva (no se convierte en false).
   *
   * Responsable efectivo = estado APROBADA + esResponsableCatedra = true.
   */
  async obtenerVinculacionesDePlan(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<VinculacionAut[]> {
    this.checkRol(rolNombre);

    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { carreraId: true },
    });
    if (!plan) throw new NotFoundException(`Plan ${planEstudioId} no encontrado`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, plan.carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: { planEstudioId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    return vinculaciones.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));
  }

  /**
   * Devuelve todas las vinculaciones de una carrera con datos del docente embebidos.
   * Agrega vinculaciones de todos los planes de la carrera en una sola consulta.
   * Se incluyen todos los estados; el consumidor filtra por estado = 'APROBADA'.
   */
  async obtenerVinculacionesDeCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<VinculacionAut[]> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: { carreraId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    return vinculaciones.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));
  }

  /**
   * Devuelve la config MOD-AUT de la facultad a la que pertenece la carrera.
   * Útil para evaluadores con alcance CARRERA que necesitan parámetros de facultad.
   * Retorna null si no existe configuración creada para la facultad.
   */
  async obtenerConfigDeCarrera(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ConfigFacultadAut | null> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    return this.obtenerConfigAut(carrera.facultadId, usuarioId, rolNombre);
  }

  // ── Vinculaciones para R-07 (cross-carrera / cross-facultad) ─────────────

  /**
   * Devuelve las vinculaciones necesarias para el evaluador R-07 con el alcance
   * adecuado al rol del usuario.
   *
   * Roles globales (ADMIN/SECRETARIA/RECTORADO) y DECANO: devuelven TODAS las
   * vinculaciones de la facultad (alcanceFacultad=true).
   * DIRECTOR_CARRERA: devuelve solo la carrera solicitada (alcanceFacultad=false).
   *   El evaluador debe producir EstadoCalculo.PARCIAL en ese caso.
   *
   * Seguridad:
   * - El scope sobre carreraId se verifica vía tieneScopeCarrera antes de consultar.
   * - Para DECANO, tieneScopeCarrera ya garantiza que su facultad coincide con la carrera.
   * - El contenido retornado pertenece exclusivamente al ámbito autorizado.
   * - No se devuelven vinculaciones de otras facultades.
   */
  async obtenerVinculacionesParaR07(
    carreraId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<VinculacionesParaR07> {
    this.checkRol(rolNombre);

    const carrera = await this.prisma.carrera.findUnique({
      where: { id: carreraId },
      select: { id: true, facultadId: true },
    });
    if (!carrera) throw new NotFoundException(`Carrera ${carreraId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) throw new ForbiddenException();

    const { facultadId } = carrera;

    const ROLES_ALCANCE_FACULTAD = new Set([
      'ADMINISTRADOR_SISTEMA',
      'SECRETARIA_ACADEMICA',
      'RECTORADO',
      'DECANO',
    ]);
    const alcanceFacultad = ROLES_ALCANCE_FACULTAD.has(rolNombre);

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: alcanceFacultad ? { facultadId } : { carreraId },
      select: {
        id: true, materiaId: true, docenteId: true, catedraId: true,
        planEstudioId: true, carreraId: true, estado: true,
        esResponsableCatedra: true, horasSemana: true,
        materia: { select: { nombre: true } },
        docente: {
          select: {
            id: true, nombre: true, apellido: true, activo: true,
            dedicacion: true, categoriaDocente: true,
          },
        },
      },
    });

    const vinculaciones: VinculacionAut[] = rows.map((v) => ({
      id: v.id,
      materiaId: v.materiaId,
      materiaNombre: v.materia?.nombre,
      docenteId: v.docenteId,
      catedraId: v.catedraId,
      planEstudioId: v.planEstudioId,
      carreraId: v.carreraId,
      estado: v.estado,
      esResponsableCatedra: v.esResponsableCatedra,
      horasSemana: v.horasSemana,
      docente: {
        id: v.docente.id,
        nombre: v.docente.nombre,
        apellido: v.docente.apellido,
        activo: v.docente.activo,
        dedicacion: v.docente.dedicacion,
        categoriaDocente: v.docente.categoriaDocente,
      },
    }));

    // Detección interna de docentes con asignaciones en otras facultades.
    // Solo se ejecuta cuando el scope cubre toda la facultad.
    // No expone datos de otras facultades; solo indica presencia (sí/no).
    const docentesMultiFacultad = alcanceFacultad
      ? await this.detectarDocentesMultiFacultad(
          [...new Set(vinculaciones.map((v) => v.docenteId))],
          facultadId,
        )
      : new Set<string>();

    return { vinculaciones, facultadId, alcanceFacultad, docentesMultiFacultad };
  }

  /**
   * Detecta docentes del scope con vinculaciones APROBADAS en otras facultades.
   * Método privado: solo accesible desde obtenerVinculacionesParaR07.
   * No expone qué otras facultades están involucradas; solo indica pertenencia al conjunto.
   */
  private async detectarDocentesMultiFacultad(
    docenteIds: string[],
    facultadIdAutorizado: string,
  ): Promise<Set<string>> {
    if (docenteIds.length === 0) return new Set();

    const rows = await this.prisma.vinculacionCatedra.findMany({
      where: {
        docenteId: { in: docenteIds },
        estado: 'APROBADA',
        facultadId: { not: facultadIdAutorizado },
        docente: { activo: true },
      },
      select: { docenteId: true },
      distinct: ['docenteId'],
    });

    return new Set(rows.map((r) => r.docenteId));
  }

  // ── Programas de asignatura ───────────────────────────────────────────────

  /**
   * Devuelve el programa de una materia si existe, o null si aún no fue creado.
   * No crea el programa automáticamente; no calcula porcentajes ni estadoFuncional.
   */
  async obtenerProgramaDeMateria(
    materiaId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ProgramaAut | null> {
    this.checkRol(rolNombre);

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { planEstudio: { select: { carreraId: true } } },
    });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(
      usuarioId,
      rolNombre,
      materia.planEstudio.carreraId,
    );
    if (!tieneScope) throw new ForbiddenException();

    const prog = await this.prisma.programaAsignatura.findUnique({
      where: { materiaId },
      select: {
        id: true, materiaId: true, estadoPrograma: true,
        estadoS1: true, estadoS2: true, estadoS3: true,
        estadoS4: true, estadoS5: true, estadoS6: true,
        fechaAprobacion: true, anioVigencia: true,
      },
    });

    if (!prog) return null;

    return {
      id: prog.id,
      materiaId: prog.materiaId,
      estadoPrograma: prog.estadoPrograma,
      secciones: {
        s1: prog.estadoS1 as EstadoSeccion,
        s2: prog.estadoS2 as EstadoSeccion,
        s3: prog.estadoS3 as EstadoSeccion,
        s4: prog.estadoS4 as EstadoSeccion,
        s5: prog.estadoS5 as EstadoSeccion,
        s6: prog.estadoS6 as EstadoSeccion,
      },
      fechaAprobacion: prog.fechaAprobacion,
      anioVigencia: prog.anioVigencia,
      tienePrograma: true,
    };
  }

  // ── Configuraciones ───────────────────────────────────────────────────────

  /**
   * Devuelve la configuración MOD-AUT de una facultad, o null si no fue creada.
   * Requiere rol en ROLES_MODAUT y scope institucional sobre la facultad solicitada.
   */
  async obtenerConfigAut(
    facultadId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<ConfigFacultadAut | null> {
    this.checkRol(rolNombre);
    await this.verificarScopeFacultad(facultadId, usuarioId, rolNombre);

    const config = await this.prisma.autoevaluacionConfigFacultad.findUnique({
      where: { facultadId },
      select: {
        facultadId: true, p01TopeH: true, p02BajaH: true,
        p03MaxMat: true, updatedAt: true,
      },
    });
    return config ?? null;
  }
}
