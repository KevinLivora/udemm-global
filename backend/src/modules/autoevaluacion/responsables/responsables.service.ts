import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';

@Injectable()
export class ResponsablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Designa o quita el responsable de cátedra de una VinculacionCatedra.
   *
   * Reglas:
   * - La vinculación debe existir y tener estado APROBADA.
   * - Si esResponsable=true: no debe haber otro registro APROBADO y true para la misma (materiaId, catedraId).
   *   Las vinculaciones DESVINCULADAS/RECHAZADAS/PENDIENTES con esResponsableCatedra=true son ignoradas.
   * - DIRECTOR_CARRERA: solo puede operar sobre su scope de carreras.
   * - ADMIN: puede operar globalmente.
   */
  async designarResponsable(
    vinculacionId: string,
    esResponsable: boolean,
    usuarioId: string,
    rolNombre: string,
  ) {
    const vinculacion = await this.prisma.vinculacionCatedra.findUnique({
      where: { id: vinculacionId },
      select: {
        id: true,
        estado: true,
        carreraId: true,
        materiaId: true,
        catedraId: true,
        docenteId: true,
        esResponsableCatedra: true,
      },
    });

    if (!vinculacion) {
      throw new NotFoundException(`Vinculación ${vinculacionId} no encontrada`);
    }

    if (vinculacion.estado !== 'APROBADA') {
      throw new UnprocessableEntityException(
        'Solo se puede designar responsable en vinculaciones con estado APROBADA',
      );
    }

    // Verificar scope para DIRECTOR_CARRERA
    if (rolNombre === 'DIRECTOR_CARRERA') {
      const tieneScope = await this.scope.tieneScopeCarrera(
        usuarioId,
        rolNombre,
        vinculacion.carreraId,
      );
      if (!tieneScope) throw new ForbiddenException();
    }

    // Si se intenta marcar como responsable, verificar que no haya otro APROBADO ya marcado.
    // Las vinculaciones DESVINCULADAS/RECHAZADAS/PENDIENTES con esResponsableCatedra=true son ignoradas:
    // corresponden a responsables históricos que no deben bloquear nuevas designaciones activas.
    if (esResponsable) {
      const responsableExistente = await this.prisma.vinculacionCatedra.findFirst({
        where: {
          materiaId: vinculacion.materiaId,
          catedraId: vinculacion.catedraId,
          esResponsableCatedra: true,
          estado: 'APROBADA',        // H-01: solo considera vinculaciones activas
          id: { not: vinculacionId },
        },
        select: { id: true, docenteId: true },
      });

      if (responsableExistente) {
        throw new ConflictException(
          'Ya existe un responsable de cátedra aprobado para esta materia y cátedra. ' +
          'Debe quitarse la designación anterior antes de asignar una nueva.',
        );
      }
    }

    // H-02: el índice parcial (WHERE esResponsableCatedra=true AND estado=APROBADA) es la
    // segunda línea de defensa ante escrituras concurrentes. Si dos peticiones pasan el
    // findFirst simultáneamente, PostgreSQL lanzará P2002, que se convierte en 409.
    try {
      return await this.prisma.vinculacionCatedra.update({
        where: { id: vinculacionId },
        data: { esResponsableCatedra: esResponsable },
        select: {
          id: true,
          docenteId: true,
          materiaId: true,
          catedraId: true,
          carreraId: true,
          planEstudioId: true,
          esResponsableCatedra: true,
          estado: true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Ya existe un responsable de cátedra aprobado para esta materia y cátedra.',
        );
      }
      throw e;
    }
  }

  /**
   * Consulta quién es el responsable confirmado de una (materia, cátedra).
   * Devuelve null si no hay responsable clasificado.
   */
  async obtenerResponsable(
    materiaId: string,
    catedraId: string,
    usuarioId: string,
    rolNombre: string,
  ) {
    // Verificar que la materia existe y obtener su planEstudio para el scope check
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: {
        id: true,
        planEstudio: { select: { carreraId: true } },
      },
    });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const tieneScope = await this.scope.tieneScopeCarrera(
      usuarioId,
      rolNombre,
      materia.planEstudio.carreraId,
    );
    if (!tieneScope) throw new ForbiddenException();

    return this.prisma.vinculacionCatedra.findFirst({
      where: {
        materiaId,
        catedraId,
        esResponsableCatedra: true,
      },
      select: {
        id: true,
        docenteId: true,
        docente: { select: { nombre: true, apellido: true } },
        materiaId: true,
        catedraId: true,
        estado: true,
      },
    });
  }
}
