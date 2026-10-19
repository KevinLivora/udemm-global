import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { ActualizarConfigFacultadDto } from '../dto/actualizar-config-facultad.dto';

@Injectable()
export class ConfigFacultadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Devuelve la config de MOD-AUT de una Facultad.
   * Verifica que el usuario tenga scope sobre la Facultad solicitada.
   * Si no existe config, devuelve null (no crea una automáticamente).
   */
  async obtenerConfig(facultadId: string, usuarioId: string, rolNombre: string) {
    await this.verificarScopeFacultad(facultadId, usuarioId, rolNombre);

    const config = await this.prisma.autoevaluacionConfigFacultad.findUnique({
      where: { facultadId },
      select: {
        id: true,
        facultadId: true,
        p01TopeH: true,
        p02BajaH: true,
        p03MaxMat: true,
        updatedAt: true,
        updatedBy: true,
      },
    });

    return config ?? null;
  }

  /**
   * Crea o actualiza la configuración de MOD-AUT de una Facultad.
   * Solo ADMINISTRADOR_SISTEMA puede llamar a este método (verificado en el controlador).
   *
   * Creación: exige los tres parámetros p01TopeH, p02BajaH y p03MaxMat (M-01).
   * Actualización: admite actualizaciones parciales.
   * Validación cruzada: p02BajaH < p01TopeH (calculado sobre valores efectivos).
   */
  async upsertConfig(
    facultadId: string,
    dto: ActualizarConfigFacultadDto,
    usuarioId: string,
  ) {
    const facultad = await this.prisma.facultad.findUnique({
      where: { id: facultadId },
      select: { id: true },
    });
    if (!facultad) throw new NotFoundException(`Facultad ${facultadId} no encontrada`);

    const configActual = await this.prisma.autoevaluacionConfigFacultad.findUnique({
      where: { facultadId },
    });

    const esCreacion = configActual === null;

    // M-01: al crear, los tres parámetros son obligatorios (sin valores predeterminados).
    if (esCreacion && (dto.p01TopeH === undefined || dto.p02BajaH === undefined || dto.p03MaxMat === undefined)) {
      throw new BadRequestException(
        'Para crear la configuración se requieren los tres parámetros: p01TopeH, p02BajaH y p03MaxMat',
      );
    }

    // Calcular valores efectivos para la validación cruzada p02 < p01
    // En actualización: usa el valor del DTO si está presente, si no el almacenado.
    const p01Efectivo = dto.p01TopeH ?? configActual!.p01TopeH;
    const p02Efectivo = dto.p02BajaH ?? configActual!.p02BajaH;

    if (p02Efectivo >= p01Efectivo) {
      throw new BadRequestException(
        `p02BajaH (${p02Efectivo}h) debe ser menor que p01TopeH (${p01Efectivo}h)`,
      );
    }

    const select = {
      id: true,
      facultadId: true,
      p01TopeH: true,
      p02BajaH: true,
      p03MaxMat: true,
      updatedAt: true,
      updatedBy: true,
    };

    // Usar create/update explícitos para evitar que Prisma valide la rama create
    // con campos undefined cuando el registro ya existe (bug: upsert valida ambas ramas).
    if (esCreacion) {
      return this.prisma.autoevaluacionConfigFacultad.create({
        data: {
          facultadId,
          p01TopeH: dto.p01TopeH!,  // garantizado definido por la validación M-01
          p02BajaH: dto.p02BajaH!,
          p03MaxMat: dto.p03MaxMat!,
          updatedBy: usuarioId,
        },
        select,
      });
    }

    const data: Record<string, unknown> = { updatedBy: usuarioId };
    if (dto.p01TopeH !== undefined) data['p01TopeH'] = dto.p01TopeH;
    if (dto.p02BajaH !== undefined) data['p02BajaH'] = dto.p02BajaH;
    if (dto.p03MaxMat !== undefined) data['p03MaxMat'] = dto.p03MaxMat;

    return this.prisma.autoevaluacionConfigFacultad.update({
      where: { facultadId },
      data,
      select,
    });
  }

  /**
   * Verifica que el usuario tenga scope institucional sobre la Facultad indicada.
   * ADMIN, SECRETARIA y RECTORADO tienen scope global.
   * DECANO: solo su facultad. DIRECTOR_CARRERA: solo sus carreras (verificación por carrera).
   */
  private async verificarScopeFacultad(
    facultadId: string,
    usuarioId: string,
    rolNombre: string,
  ): Promise<void> {
    const ROLES_GLOBALES = new Set([
      'ADMINISTRADOR_SISTEMA',
      'SECRETARIA_ACADEMICA',
      'RECTORADO',
    ]);

    if (ROLES_GLOBALES.has(rolNombre)) return;

    if (rolNombre === 'DECANO') {
      const asoc = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId, facultadId },
      });
      if (!asoc) throw new ForbiddenException();
      return;
    }

    if (rolNombre === 'DIRECTOR_CARRERA') {
      // El director puede leer la config de la facultad si tiene al menos una carrera en esa facultad
      const carreras = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
      if (!carreras || carreras.length === 0) throw new ForbiddenException();
      const carreraEnFacultad = await this.prisma.carrera.findFirst({
        where: { id: { in: carreras }, facultadId },
      });
      if (!carreraEnFacultad) throw new ForbiddenException();
      return;
    }

    throw new ForbiddenException();
  }
}
