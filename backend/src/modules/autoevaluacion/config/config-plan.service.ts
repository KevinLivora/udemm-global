import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { ActualizarConfigPlanDto } from '../dto/actualizar-config-plan.dto';

@Injectable()
export class ConfigPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Devuelve los umbrales horarios de un Plan de Estudio.
   * Verifica scope sobre la carrera del plan.
   */
  async obtenerUmbrales(planEstudioId: string, usuarioId: string, rolNombre: string) {
    const plan = await this.cargarPlanConScope(planEstudioId, usuarioId, rolNombre);

    return {
      planEstudioId: plan.id,
      horasMinTotales: plan.horasMinTotales,
      horasMinCB: plan.horasMinCB,
      horasMinTB: plan.horasMinTB,
      horasMinTA: plan.horasMinTA,
      horasMinCTX: plan.horasMinCTX,
    };
  }

  /**
   * Actualiza los umbrales horarios de un Plan de Estudio.
   * Solo ADMINISTRADOR_SISTEMA puede llamar a este método (verificado en el controlador).
   */
  async actualizarUmbrales(
    planEstudioId: string,
    dto: ActualizarConfigPlanDto,
  ) {
    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: { id: true },
    });
    if (!plan) throw new NotFoundException(`Plan de estudio ${planEstudioId} no encontrado`);

    // Solo actualiza los campos presentes en el DTO; undefined = sin cambio
    const data: Record<string, number | null | undefined> = {};
    if ('horasMinTotales' in dto) data['horasMinTotales'] = dto.horasMinTotales ?? null;
    if ('horasMinCB' in dto) data['horasMinCB'] = dto.horasMinCB ?? null;
    if ('horasMinTB' in dto) data['horasMinTB'] = dto.horasMinTB ?? null;
    if ('horasMinTA' in dto) data['horasMinTA'] = dto.horasMinTA ?? null;
    if ('horasMinCTX' in dto) data['horasMinCTX'] = dto.horasMinCTX ?? null;

    if (Object.keys(data).length === 0) {
      return this.obtenerUmbralesSinScope(planEstudioId);
    }

    return this.prisma.planEstudio.update({
      where: { id: planEstudioId },
      data,
      select: {
        id: true,
        horasMinTotales: true,
        horasMinCB: true,
        horasMinTB: true,
        horasMinTA: true,
        horasMinCTX: true,
      },
    });
  }

  /** Carga el plan y verifica scope del usuario. Lanza 404/403 según corresponda. */
  private async cargarPlanConScope(
    planEstudioId: string,
    usuarioId: string,
    rolNombre: string,
  ) {
    const plan = await this.prisma.planEstudio.findUnique({
      where: { id: planEstudioId },
      select: {
        id: true,
        carreraId: true,
        horasMinTotales: true,
        horasMinCB: true,
        horasMinTB: true,
        horasMinTA: true,
        horasMinCTX: true,
      },
    });
    if (!plan) throw new NotFoundException(`Plan de estudio ${planEstudioId} no encontrado`);

    const tieneScope = await this.scope.tieneScopeCarrera(usuarioId, rolNombre, plan.carreraId);
    if (!tieneScope) throw new ForbiddenException();

    return plan;
  }

  private async obtenerUmbralesSinScope(planEstudioId: string) {
    return this.prisma.planEstudio.findUniqueOrThrow({
      where: { id: planEstudioId },
      select: {
        id: true,
        horasMinTotales: true,
        horasMinCB: true,
        horasMinTB: true,
        horasMinTA: true,
        horasMinCTX: true,
      },
    });
  }
}
