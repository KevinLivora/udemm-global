import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { R02EvaluadorService } from './r02.evaluador';
import { R06EvaluadorService } from './r06.evaluador';
import { R07EvaluadorService } from './r07.evaluador';
import { R08EvaluadorService } from './r08.evaluador';
import { R09EvaluadorService } from './r09.evaluador';
import { R12EvaluadorService } from './r12.evaluador';
import { RegistroIndicadores } from './indicadores.registry';
import type { AlcanceIndicador, ContextoEvaluacion, ResultadoIndicador } from './indicadores.types';
import { resultadoNoImplementado } from './indicadores.types';

export interface SolicitudEvaluacion {
  codigoIndicador: string;
  contexto: ContextoEvaluacion;
}

/**
 * Roles autorizados para acceder a MOD-AUT.
 * ADMINISTRATIVO queda excluido aunque ScopeService lo incluya en ROLES_GLOBALES.
 */
const ROLES_MODAUT = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
]);

const ROLES_GLOBALES = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
]);

/**
 * Orquestador del motor de indicadores MOD-AUT.
 *
 * Responsabilidades:
 * 1. Validar el rol autorizado.
 * 2. Verificar el alcance institucional del contexto solicitado.
 * 3. Identificar el indicador en el registro.
 * 4. Determinar si existe una implementación real.
 * 5. Si existe evaluador, delegar el cálculo; si no, devolver NO_IMPLEMENTADO.
 * 6. Conservar datos faltantes y normalizar el resultado.
 *
 * No expone endpoints HTTP.
 * No duplica ScopeService ni ConsultasAcademicasService.
 * No devuelve resultados académicos ficticios.
 */
@Injectable()
export class IndicadoresService {
  constructor(
    private readonly scope: ScopeService,
    private readonly registro: RegistroIndicadores,
    private readonly prisma: PrismaService,
    private readonly r02: R02EvaluadorService,
    private readonly r08: R08EvaluadorService,
    private readonly r09: R09EvaluadorService,
    private readonly r06: R06EvaluadorService,
    private readonly r07: R07EvaluadorService,
    private readonly r12: R12EvaluadorService,
  ) {
    this.registro.asignarEvaluador('R-02', r02);
    this.registro.asignarEvaluador('R-06', r06);
    this.registro.asignarEvaluador('R-07', r07);
    this.registro.asignarEvaluador('R-08', r08);
    this.registro.asignarEvaluador('R-09', r09);
    this.registro.asignarEvaluador('R-12', r12);
  }

  async evaluar(solicitud: SolicitudEvaluacion): Promise<ResultadoIndicador<unknown>> {
    this.checkRol(solicitud.contexto.rolNombre);
    await this.verificarAlcance(solicitud.contexto);

    const def = this.registro.obtener(solicitud.codigoIndicador);
    if (!def) {
      throw new NotFoundException(
        `Indicador ${solicitud.codigoIndicador} no está registrado en MOD-AUT`,
      );
    }

    if (!def.evaluador) {
      return resultadoNoImplementado(
        def.codigo,
        this.resolverContextoId(solicitud.contexto, def.alcance),
        def.alcance,
        solicitud.contexto.fechaEvaluacion,
      );
    }

    return def.evaluador.evaluar(solicitud.contexto);
  }

  private checkRol(rolNombre: string): void {
    if (!ROLES_MODAUT.has(rolNombre)) {
      throw new ForbiddenException('Rol sin acceso a MOD-AUT');
    }
  }

  /**
   * Verifica que el usuario tenga scope institucional sobre la entidad solicitada.
   *
   * - Roles globales: acceso irrestricto.
   * - DECANO / DIRECTOR_CARRERA: requieren carreraId (directo o derivado de planEstudioId).
   * - Sin carreraId ni planEstudioId: 403 — no se permite evaluación sin contexto territorial.
   *
   * El contexto no amplía permisos: los IDs son validados contra ScopeService, nunca confiados.
   */
  private async verificarAlcance(contexto: ContextoEvaluacion): Promise<void> {
    if (ROLES_GLOBALES.has(contexto.rolNombre)) return;

    let carreraIdTarget = contexto.carreraId;

    if (!carreraIdTarget && contexto.planEstudioId) {
      const plan = await this.prisma.planEstudio.findUnique({
        where: { id: contexto.planEstudioId },
        select: { carreraId: true },
      });
      if (!plan) {
        throw new NotFoundException(`Plan ${contexto.planEstudioId} no encontrado`);
      }
      carreraIdTarget = plan.carreraId;
    }

    if (!carreraIdTarget) {
      throw new ForbiddenException(
        'Se requiere carreraId o planEstudioId para roles con scope territorial',
      );
    }

    const tieneScope = await this.scope.tieneScopeCarrera(
      contexto.usuarioId,
      contexto.rolNombre,
      carreraIdTarget,
    );
    if (!tieneScope) throw new ForbiddenException();
  }

  private resolverContextoId(contexto: ContextoEvaluacion, alcance: AlcanceIndicador): string {
    switch (alcance) {
      case 'PLAN':
        return contexto.planEstudioId ?? contexto.carreraId ?? contexto.facultadId ?? 'GLOBAL';
      case 'CARRERA':
        return contexto.carreraId ?? contexto.facultadId ?? 'GLOBAL';
      case 'FACULTAD':
        return contexto.facultadId ?? 'GLOBAL';
      default:
        return contexto.carreraId ?? contexto.planEstudioId ?? contexto.facultadId ?? 'GLOBAL';
    }
  }
}
