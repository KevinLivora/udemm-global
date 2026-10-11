import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../scopes/scope.service';
import { ActualizarProgramaDto } from './dto/actualizar-programa.dto';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { GenerarRegularizacionDto } from './dto/generar-regularizacion.dto';
import { SolicitarCorreccionesDto } from './dto/solicitar-correcciones.dto';

const ROLES_APROBADOR = ['SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA', 'DECANO', 'RECTORADO'] as const;

const HISTORIAL_INCLUDE = {
  historial: {
    include: {
      usuario: {
        select: { id: true, nombre: true, apellido: true, correoElectronico: true }
      }
    },
    orderBy: { fecha: 'desc' as const },
    take: 50
  }
};

// ── Helpers de cálculo de estado (espejo exacto de la lógica frontend) ────────

function tryParseJsonArr<T>(str: unknown): T[] {
  if (!str || typeof str !== 'string') return [];
  try {
    const r = JSON.parse(str);
    return Array.isArray(r) ? (r as T[]) : [];
  } catch {
    return [];
  }
}

function str(prog: Record<string, unknown>, key: string): string {
  return String(prog[key] ?? '').trim();
}

function calcEstadoSecciones(prog: Record<string, unknown>): Record<string, string> {
  // S1: objetivosGenerales + aportesPerfilTitulo obligatorios (textarea >50 chars)
  const s1 =
    str(prog, 'objetivosGenerales').length > 50 &&
    str(prog, 'aportesPerfilTitulo').length > 50
      ? 'COMPLETO' : 'PENDIENTE';

  // S2: competencias con competencia+resultado, contenidos con conceptuales+procedimentales+actitudinales
  type CR = { competencia?: string; resultadoAprendizaje?: string };
  type CO = { conceptuales?: string; procedimentales?: string; actitudinales?: string };
  const comps = tryParseJsonArr<CR>(prog['competenciasResultadosJson']);
  const conts = tryParseJsonArr<CO>(prog['contenidosGridJson']);
  const hasComp = comps.some(r => (r.competencia?.trim().length ?? 0) > 0 && (r.resultadoAprendizaje?.trim().length ?? 0) > 0);
  const hasCont = conts.some(r => (r.conceptuales?.trim().length ?? 0) > 0 && (r.procedimentales?.trim().length ?? 0) > 0 && (r.actitudinales?.trim().length ?? 0) > 0);
  const s2 = hasComp && hasCont ? 'COMPLETO' : 'PENDIENTE';

  // S3: unidades didácticas con al menos una unidad no vacía
  type UD = { unidad?: string };
  const uds = tryParseJsonArr<UD>(prog['unidadesDidacticasJson']);
  const s3 = uds.some(r => (r.unidad?.trim().length ?? 0) > 0) ? 'COMPLETO' : 'PENDIENTE';

  // S4: actividadesFormacionPractica (texto >50 chars) + al menos una fila de intensidad válida
  type IF4 = { intensidad?: string; horasClase?: number };
  const ifs = tryParseJsonArr<IF4>(prog['formacionPracticaJson']);
  const s4 =
    str(prog, 'actividadesFormacionPractica').length > 50 &&
    ifs.some(f =>
      (f.intensidad?.trim().length ?? 0) > 0 &&
      typeof f.horasClase === 'number' && Number.isInteger(f.horasClase) &&
      f.horasClase >= 0 && f.horasClase <= 99
    ) ? 'COMPLETO' : 'PENDIENTE';

  // S5: 4 campos textarea obligatorios >50 chars
  const s5 =
    str(prog, 'recursosDidacticos').length > 50 &&
    str(prog, 'metodologiaEnsenanza').length > 50 &&
    str(prog, 'modalidadEvaluacion').length > 50 &&
    str(prog, 'requisitosAprobacion').length > 50
      ? 'COMPLETO' : 'PENDIENTE';

  // S6: bibliografiaBasica >50 chars + fechaVigenciaPrograma + fechaAprobacion
  const s6 =
    str(prog, 'bibliografiaBasica').length > 50 &&
    prog['fechaVigenciaPrograma'] != null &&
    prog['fechaAprobacion'] != null
      ? 'COMPLETO' : 'PENDIENTE';

  return { estadoS1: s1, estadoS2: s2, estadoS3: s3, estadoS4: s4, estadoS5: s5, estadoS6: s6 };
}

// ── Clasificación de campos que requieren nueva aprobación ────────────────────
// SUSTANCIALES: contenido académico del programa — su modificación invalida la aprobación.
// ADMINISTRATIVOS: metadatos de gestión — su modificación no requiere nueva aprobación.

const CAMPOS_SUSTANCIALES = new Set([
  // Sección 1 (académica)
  'objetivosGenerales', 'aportesPerfilTitulo', 'recomendacionesCursado',
  // Sección 2
  'competenciasResultadosJson', 'contenidosGridJson',
  // Sección 2 legacy
  'fundamentacion', 'propositos', 'objetivosEspecificos',
  // Sección 3
  'unidadesDidacticasJson', 'contenidosSinteticos', 'contenidosTematicos',
  'bibliografiaBasica', 'bibliografiaComplementaria', 'recursosDidacticos',
  // Sección 4
  'actividadesFormacionPractica', 'formacionPracticaJson',
  'metodologiaEnsenanza', 'tiposFormacionPractica', 'porcentajeTiempoFormacion',
  'actividadesPracticas', 'cronograma',
  // Sección 5
  'modalidadEvaluacion', 'requisitosAprobacion',
  'criteriosEvaluacion', 'instrumentosEvaluacion', 'condicionesAprobacion',
  // Otros académicos
  'competenciasVinculadas',
]);

function detectarCambioSustancial(
  data: Record<string, unknown>,
  actual: Record<string, unknown>,
): boolean {
  for (const campo of CAMPOS_SUSTANCIALES) {
    if (campo in data && data[campo] !== actual[campo]) return true;
  }
  return false;
}

// ── Estado funcional visible (4 valores — C13/C16) ───────────────────────────
// Derivado en tiempo de ejecución: sin columna nueva en BD.
// Prioridad: EN_CORRECCION > EN_REVISION > APROBADO > INCOMPLETO
// C16: todasCompletas usado en el fallback → programa 100% sin solicitud
// muestra EN_REVISION en lugar de INCOMPLETO (programas históricos pre-circuito).
export function calcEstadoFuncional(
  estadoPrograma: string,
  todasCompletas: boolean,
  solicitudActual: { estado: string } | null | undefined,
): string {
  if (solicitudActual?.estado === 'CORRECCIONES_SOLICITADAS') return 'EN_CORRECCION';
  if (solicitudActual?.estado === 'PENDIENTE_APROBACION') return 'EN_REVISION';
  if (estadoPrograma === 'APROBADO') return 'APROBADO';
  if (!todasCompletas) return 'INCOMPLETO';
  // Programa al 100% sin solicitud activa y sin aprobación vigente.
  // Caso histórico: programa completado antes de que existiera el circuito.
  // Se muestra EN_REVISION como señal de que requiere incorporarse al circuito.
  return 'EN_REVISION';
}

// ── Include para solicitudes en obtenerPrograma ───────────────────────────────
const SOLICITUD_ACTUAL_INCLUDE = {
  select: {
    id: true, estado: true, fechaCreacion: true, fechaResolucion: true,
    observaciones: true,
    aprobador: { select: { id: true, nombre: true, apellido: true } },
  },
};

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class ProgramasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
  ) {}

  private async resolverCarreraDeMateria(materiaId: string): Promise<string> {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { planEstudio: { select: { carreraId: true } } },
    });
    const carreraId = materia?.planEstudio?.carreraId;
    if (!carreraId) throw new NotFoundException(`No se pudo resolver la carrera para la materia ${materiaId}`);
    return carreraId;
  }

  async obtenerPrograma(materiaId: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const prog = await this.prisma.programaAsignatura.upsert({
      where: { materiaId },
      create: { materiaId },
      update: {},
      include: {
        ...HISTORIAL_INCLUDE,
        solicitudes: {
          orderBy: { fechaCreacion: 'desc' },
          take: 1,
          ...SOLICITUD_ACTUAL_INCLUDE,
        },
      },
    });

    const estadoSecciones = calcEstadoSecciones(prog as unknown as Record<string, unknown>);
    const todasCompletas = Object.values(estadoSecciones).every(v => v === 'COMPLETO');

    // C13: usar el estadoPrograma real de la BD sin sobreescritura artificial.
    // EN_REVISION requiere solicitud persistida; no se infiere solo del 100%.
    const estadoPrograma: string = prog.estadoPrograma;

    const solicitudActual = (prog as any).solicitudes?.[0] ?? null;
    const estadoFuncional = calcEstadoFuncional(estadoPrograma, todasCompletas, solicitudActual);
    return { ...prog, ...estadoSecciones, estadoPrograma, solicitudActual, estadoFuncional };
  }

  async actualizarPrograma(materiaId: string, dto: ActualizarProgramaDto, usuarioId: string, rolNombre: string) {
    if (rolNombre === 'DOCENTE') {
      const docente = await this.prisma.docente.findUnique({
        where: { usuarioId },
        select: { id: true },
      });
      if (!docente) {
        throw new ForbiddenException('No se encontró un perfil docente asociado a tu usuario');
      }
      const vinculacion = await this.prisma.vinculacionCatedra.findFirst({
        where: { docenteId: docente.id, materiaId, estado: 'APROBADA' },
        select: { id: true },
      });
      if (!vinculacion) {
        throw new ForbiddenException('No tienes una vinculación aprobada con esta asignatura');
      }
    }

    if (rolNombre === 'DIRECTOR_CARRERA' || rolNombre === 'DECANO') {
      const carreraId = await this.resolverCarreraDeMateria(materiaId);
      const tieneScope = await this.scopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
      if (!tieneScope) {
        throw new ForbiddenException('Sin acceso: la materia no pertenece a tu carrera o facultad asignada');
      }
    }
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException(`Materia ${materiaId} no encontrada`);

    const { seccionModificada, fechaAprobacion, ...rest } = dto;

    const data: Record<string, unknown> = { ...rest };
    if (fechaAprobacion !== undefined) {
      data.fechaAprobacion = fechaAprobacion ? new Date(fechaAprobacion) : null;
    }

    // Validar horasClase en formacionPracticaJson: debe ser entero 0-99
    if (typeof data.formacionPracticaJson === 'string') {
      try {
        const rows = JSON.parse(data.formacionPracticaJson as string);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.horasClase !== undefined && row.horasClase !== null) {
              const hc = Number(row.horasClase);
              if (!Number.isInteger(hc) || hc < 0 || hc > 99) {
                throw new BadRequestException('horasClase debe ser un entero entre 0 y 99');
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
      }
    }

    // Validar horas en unidadesDidacticasJson: si se proporciona, debe ser string de dígitos
    if (typeof data.unidadesDidacticasJson === 'string') {
      try {
        const rows = JSON.parse(data.unidadesDidacticasJson as string);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.horas !== undefined && row.horas !== null && row.horas !== '') {
              if (!/^[0-9]+$/.test(String(row.horas))) {
                throw new BadRequestException('horas en unidades didácticas debe contener solo dígitos enteros positivos');
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
      }
    }

    const programaActual = await this.prisma.programaAsignatura.findFirst({ where: { materiaId } });

    // ── Calcular si el cambio requiere nueva aprobación ───────────────────────
    const eraAprobado = programaActual?.estadoPrograma === 'APROBADO';
    const cambioSustancial = eraAprobado
      ? detectarCambioSustancial(data, programaActual as unknown as Record<string, unknown>)
      : false;

    // Calcular estados desde la unión de datos actuales y entrantes
    const mergedForCalc: Record<string, unknown> = {
      ...((programaActual as unknown as Record<string, unknown>) ?? {}),
      ...data,
    };
    const estadoSecciones = calcEstadoSecciones(mergedForCalc);
    const todasCompletas = Object.values(estadoSecciones).every(v => v === 'COMPLETO');

    // Si era APROBADO y no hubo cambio sustancial: conservar APROBADO.
    // Si era APROBADO pero hubo cambio sustancial: pasar a EN_REVISION/PENDIENTE.
    // En cualquier otro caso: calcular normalmente.
    const nuevoEstadoProg =
      eraAprobado && !cambioSustancial
        ? 'APROBADO'
        : todasCompletas
          ? 'EN_REVISION'
          : 'PENDIENTE';

    const finalData = { ...data, ...estadoSecciones, estadoPrograma: nuevoEstadoProg };
    const descripcion = seccionModificada
      ? `Sección "${seccionModificada}" actualizada`
      : 'Programa actualizado';

    // ── Upsert + historial + gestión de solicitud en una sola transacción ──────
    const programa = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const upserted = await tx.programaAsignatura.upsert({
        where: { materiaId },
        create: { materiaId, ...finalData },
        update: finalData,
      });
      await tx.historialPrograma.create({
        data: {
          programaId: upserted.id,
          usuarioId,
          accion: 'ACTUALIZACION',
          seccion: seccionModificada ?? null,
          descripcion,
        },
      });

      // ── Gestión del circuito de aprobación (C13) ─────────────────────────────
      if (nuevoEstadoProg !== 'APROBADO') {
        // Cambio sustancial o bajó del 100%: invalidar PENDIENTE_APROBACION.
        if (cambioSustancial || !todasCompletas) {
          await tx.solicitudAprobacionPrograma.updateMany({
            where: { programaId: upserted.id, estado: 'PENDIENTE_APROBACION' },
            data: { estado: 'INVALIDADA', fechaResolucion: new Date() },
          });
        }
        // Cambio sustancial también cierra el ciclo de correcciones activo.
        if (cambioSustancial) {
          await tx.solicitudAprobacionPrograma.updateMany({
            where: { programaId: upserted.id, estado: 'CORRECCIONES_SOLICITADAS' },
            data: { estado: 'INVALIDADA', fechaResolucion: new Date() },
          });
        }

        // Al 100% y sin solicitud activa (no hay PENDIENTE ni CORRECCIONES en curso):
        // crear solicitud y notificar directivos.
        if (todasCompletas) {
          const solicitudActiva = await tx.solicitudAprobacionPrograma.findFirst({
            where: {
              programaId: upserted.id,
              estado: { in: ['PENDIENTE_APROBACION', 'CORRECCIONES_SOLICITADAS'] },
            },
          });
          if (!solicitudActiva) {
            const nueva = await tx.solicitudAprobacionPrograma.create({
              data: { programaId: upserted.id, estado: 'PENDIENTE_APROBACION' },
            });
            await this.notificarDirectivos(tx, nueva.id, materiaId, 'NUEVA_SOLICITUD_APROBACION');
          }
        }
      }

      return upserted;
    });

    const result = await this.prisma.programaAsignatura.findUnique({
      where: { id: programa.id },
      include: {
        ...HISTORIAL_INCLUDE,
        solicitudes: {
          orderBy: { fechaCreacion: 'desc' },
          take: 1,
          ...SOLICITUD_ACTUAL_INCLUDE,
        },
      },
    });
    const solicitudActual = (result as any)?.solicitudes?.[0] ?? null;
    const estadoFuncional = calcEstadoFuncional(nuevoEstadoProg, todasCompletas, solicitudActual);
    return { ...result, ...estadoSecciones, estadoPrograma: nuevoEstadoProg, solicitudActual, estadoFuncional };
  }

  // ── Circuito de aprobación ────────────────────────────────────────────────

  async obtenerSolicitudes(usuarioId: string, rolNombre: string) {
    const carrerasEnScope = await this.scopeService.getCarrerasEnScope(usuarioId, rolNombre);

    const where: Record<string, unknown> =
      carrerasEnScope === null
        ? {}
        : {
            programa: {
              materia: {
                planEstudio: {
                  carreraId: { in: carrerasEnScope },
                },
              },
            },
          };

    return this.prisma.solicitudAprobacionPrograma.findMany({
      where,
      include: {
        programa: {
          include: {
            materia: {
              include: {
                planEstudio: {
                  include: {
                    carrera: {
                      include: { facultad: true },
                    },
                  },
                },
              },
            },
          },
        },
        aprobador: { select: { id: true, nombre: true, apellido: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async aprobarSolicitud(solicitudId: string, usuarioId: string, rolNombre: string) {
    // Cargar solicitud con datos de scope + datos para notificación
    const solicitud = await this.prisma.solicitudAprobacionPrograma.findUnique({
      where: { id: solicitudId },
      include: {
        programa: {
          include: {
            materia: {
              include: {
                planEstudio: {
                  include: { carrera: true },
                },
              },
            },
          },
        },
      },
    });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.estado !== 'PENDIENTE_APROBACION') {
      throw new ConflictException('Esta solicitud ya fue resuelta');
    }

    // Validar scope institucional del aprobador
    const carreraId = solicitud.programa.materia.planEstudio.carreraId;
    if (!carreraId) throw new NotFoundException('No se pudo resolver la carrera del programa');
    const tieneScope = await this.scopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) {
      throw new ForbiddenException('Sin acceso: el programa no pertenece a tu carrera o facultad asignada');
    }

    // Re-verificar que el programa sigue estando al 100% antes de aprobar
    const prog = await this.prisma.programaAsignatura.findUnique({
      where: { id: solicitud.programaId },
    });
    if (!prog) throw new NotFoundException('Programa no encontrado');
    const estados = calcEstadoSecciones(prog as unknown as Record<string, unknown>);
    const todasCompletas = Object.values(estados).every(v => v === 'COMPLETO');
    if (!todasCompletas) {
      throw new BadRequestException(
        'El programa ya no está completo al 100%. Debe corregirse antes de ser aprobado.',
      );
    }

    // Datos del aprobador y contexto para la notificación (pre-transacción)
    const usuarioAprobador = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, apellido: true },
    });
    const nombreAprobador = usuarioAprobador
      ? `${usuarioAprobador.nombre} ${usuarioAprobador.apellido}`
      : rolNombre;

    const materia = solicitud.programa.materia;
    const carrera = materia.planEstudio.carrera;
    const plan    = materia.planEstudio;

    // Identificar docentes con vinculación APROBADA para notificar
    const vinculacionesAprobadas = await this.prisma.vinculacionCatedra.findMany({
      where: { materiaId: solicitud.programa.materiaId, estado: 'APROBADA' },
      include: { docente: { select: { id: true, usuarioId: true } } },
    });
    const docentesDestino = vinculacionesAprobadas
      .map(v => v.docente)
      .filter((d, idx, arr) => arr.findIndex(x => x.id === d.id) === idx);

    const fechaAprobacion = new Date();

    // Transacción atómica: aprobar solicitud + actualizar programa + historial + notificaciones
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Re-verificar dentro de la transacción para proteger contra aprobaciones simultáneas
      const solicitudActual = await tx.solicitudAprobacionPrograma.findFirst({
        where: { id: solicitudId, estado: 'PENDIENTE_APROBACION' },
      });
      if (!solicitudActual) {
        throw new ConflictException('Esta solicitud ya fue resuelta por otro usuario');
      }

      await tx.solicitudAprobacionPrograma.update({
        where: { id: solicitudId },
        data: {
          estado: 'APROBADO',
          aprobadorId: usuarioId,
          fechaResolucion: fechaAprobacion,
        },
      });

      await tx.programaAsignatura.update({
        where: { id: solicitud.programaId },
        data: { estadoPrograma: 'APROBADO' },
      });

      // Invalidar cualquier otra solicitud pendiente del mismo programa (seguridad)
      await tx.solicitudAprobacionPrograma.updateMany({
        where: {
          programaId: solicitud.programaId,
          estado: 'PENDIENTE_APROBACION',
          id: { not: solicitudId },
        },
        data: { estado: 'INVALIDADA', fechaResolucion: fechaAprobacion },
      });

      await tx.historialPrograma.create({
        data: {
          programaId: solicitud.programaId,
          usuarioId,
          accion: 'APROBACION',
          descripcion: `Programa aprobado por ${rolNombre}`,
        },
      });

      // Notificar a cada docente con vinculación APROBADA (sin duplicados)
      const cuerpoParsed = JSON.stringify({
        solicitudId,
        materiaId: solicitud.programa.materiaId,
        materia:   materia.nombre,
        carrera:   carrera.nombre,
        plan:      plan.nombre,
        directivo: nombreAprobador,
        rolDirectivo: rolNombre,
        fechaAprobacion: fechaAprobacion.toISOString(),
      });

      for (const docente of docentesDestino) {
        const existe = await tx.notificacion.findFirst({
          where: { docenteId: docente.id, solicitudProgramaId: solicitudId, leida: false },
        });
        if (!existe) {
          await tx.notificacion.create({
            data: {
              tipo: 'APROBACION_PROGRAMA',
              titulo: `Programa aprobado: ${materia.nombre}`,
              cuerpo: cuerpoParsed,
              docenteId: docente.id,
              solicitudProgramaId: solicitudId,
            },
          });
        }
      }

      return { mensaje: 'Programa aprobado correctamente', solicitudId };
    });
  }

  async solicitarCorrecciones(
    solicitudId: string,
    dto: SolicitarCorreccionesDto,
    usuarioId: string,
    rolNombre: string,
  ) {
    const solicitud = await this.prisma.solicitudAprobacionPrograma.findUnique({
      where: { id: solicitudId },
      include: {
        programa: {
          include: {
            materia: {
              include: {
                planEstudio: {
                  include: {
                    carrera: { include: { facultad: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.estado !== 'PENDIENTE_APROBACION') {
      throw new ConflictException('Esta solicitud ya fue resuelta');
    }

    const carreraId = solicitud.programa.materia.planEstudio.carreraId;
    if (!carreraId) throw new NotFoundException('No se pudo resolver la carrera del programa');
    const tieneScope = await this.scopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
    if (!tieneScope) {
      throw new ForbiddenException('Sin acceso: el programa no pertenece a tu carrera o facultad asignada');
    }

    // Identificar docentes con vinculación APROBADA para notificar
    const vinculacionesAprobadas = await this.prisma.vinculacionCatedra.findMany({
      where: { materiaId: solicitud.programa.materiaId, estado: 'APROBADA' },
      include: { docente: { select: { id: true, usuarioId: true } } },
    });
    const docentesDestino = vinculacionesAprobadas
      .map(v => v.docente)
      .filter((d, idx, arr) => arr.findIndex(x => x.id === d.id) === idx);

    // Datos del usuario que solicita correcciones
    const usuarioSolicitante = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, apellido: true },
    });
    const nombreSolicitante = usuarioSolicitante
      ? `${usuarioSolicitante.nombre} ${usuarioSolicitante.apellido}`
      : rolNombre;

    const materia = solicitud.programa.materia;
    const carrera = materia.planEstudio.carrera;
    const plan    = materia.planEstudio;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Re-verificar dentro de la transacción
      const solicitudActual = await tx.solicitudAprobacionPrograma.findFirst({
        where: { id: solicitudId, estado: 'PENDIENTE_APROBACION' },
      });
      if (!solicitudActual) {
        throw new ConflictException('Esta solicitud ya fue resuelta por otro usuario');
      }

      await tx.solicitudAprobacionPrograma.update({
        where: { id: solicitudId },
        data: {
          estado: 'CORRECCIONES_SOLICITADAS',
          aprobadorId: usuarioId,
          fechaResolucion: new Date(),
          observaciones: dto.observaciones,
        },
      });

      // Garantizar que estadoPrograma no quede en APROBADO con correcciones activas
      await tx.programaAsignatura.update({
        where: { id: solicitud.programaId },
        data: { estadoPrograma: 'EN_REVISION' },
      });

      // Crear el primer mensaje del hilo de conversación
      await tx.mensajeCorrecionPrograma.create({
        data: {
          solicitudId,
          programaId: solicitud.programaId,
          usuarioId,
          rolNombre,
          contenido: dto.observaciones,
          tipo: 'CORRECCION',
        },
      });

      await tx.historialPrograma.create({
        data: {
          programaId: solicitud.programaId,
          usuarioId,
          accion: 'CORRECCIONES_SOLICITADAS',
          seccion: 'Correcciones',
          descripcion: `Correcciones solicitadas por ${rolNombre}: ${dto.observaciones}`,
        },
      });

      // Crear notificación para cada docente con vinculación APROBADA (sin duplicados)
      const cuerpoParsed = JSON.stringify({
        solicitudId,
        materia: materia.nombre,
        carrera: carrera.nombre,
        plan: plan.nombre,
        directivo: nombreSolicitante,
        rolDirectivo: rolNombre,
        observaciones: dto.observaciones,
      });

      for (const docente of docentesDestino) {
        // Evitar duplicar si ya existe una notificación no leída para esta solicitud y docente
        const existe = await tx.notificacion.findFirst({
          where: { docenteId: docente.id, solicitudProgramaId: solicitudId, leida: false },
        });
        if (!existe) {
          await tx.notificacion.create({
            data: {
              tipo: 'CORRECCIONES_PROGRAMA',
              titulo: `Correcciones solicitadas: ${materia.nombre}`,
              cuerpo: cuerpoParsed,
              docenteId: docente.id,
              solicitudProgramaId: solicitudId,
            },
          });
        }
      }

      return { mensaje: 'Correcciones solicitadas correctamente', solicitudId };
    });
  }

  // ── Conversación DOCENTE ↔ DIRECTIVO ─────────────────────────────────────────

  private async verificarAccesoConversacion(
    solicitudId: string,
    usuarioId: string,
    rolNombre: string,
  ) {
    const solicitud = await this.prisma.solicitudAprobacionPrograma.findUnique({
      where: { id: solicitudId },
      include: {
        programa: {
          include: {
            materia: {
              include: { planEstudio: { select: { carreraId: true } } },
            },
          },
        },
      },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    if (rolNombre === 'DOCENTE') {
      const docente = await this.prisma.docente.findUnique({
        where: { usuarioId },
        select: { id: true },
      });
      if (!docente) throw new ForbiddenException('Sin perfil docente asociado');
      const vinc = await this.prisma.vinculacionCatedra.findFirst({
        where: { docenteId: docente.id, materiaId: solicitud.programa.materiaId, estado: 'APROBADA' },
        select: { id: true },
      });
      if (!vinc) throw new ForbiddenException('No tenés una vinculación aprobada con esta asignatura');
      return { solicitud, docenteId: docente.id };
    }

    if ((ROLES_APROBADOR as readonly string[]).includes(rolNombre)) {
      const carreraId = solicitud.programa.materia.planEstudio.carreraId;
      if (!carreraId) throw new NotFoundException('No se pudo resolver la carrera del programa');
      const tieneScope = await this.scopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
      if (!tieneScope) throw new ForbiddenException('Sin acceso: el programa no pertenece a tu scope institucional');
      return { solicitud, docenteId: null };
    }

    throw new ForbiddenException('No tenés permiso para acceder a esta conversación');
  }

  async obtenerMensajes(solicitudId: string, usuarioId: string, rolNombre: string) {
    await this.verificarAccesoConversacion(solicitudId, usuarioId, rolNombre);

    return this.prisma.mensajeCorrecionPrograma.findMany({
      where: { solicitudId },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
      },
      orderBy: { fechaCreacion: 'asc' },
    });
  }

  async enviarMensaje(
    solicitudId: string,
    dto: EnviarMensajeDto,
    usuarioId: string,
    rolNombre: string,
  ) {
    const { solicitud, docenteId } = await this.verificarAccesoConversacion(solicitudId, usuarioId, rolNombre);

    const tipo = rolNombre === 'DOCENTE' ? 'RESPUESTA' : 'CORRECCION';

    if (!dto.contenido?.trim()) {
      throw new BadRequestException('El contenido del mensaje no puede estar vacío');
    }

    // Solo DOCENTE puede responder a solicitudes CORRECCIONES_SOLICITADAS
    // Directivos pueden enviar mensajes en cualquier estado (también en PENDIENTE_APROBACION
    // para iniciar diálogo previo a la decisión formal)
    if (rolNombre === 'DOCENTE' && solicitud.estado !== 'CORRECCIONES_SOLICITADAS') {
      throw new ConflictException('Solo podés responder a solicitudes con correcciones pendientes');
    }

    const mensaje = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const nuevo = await tx.mensajeCorrecionPrograma.create({
        data: {
          solicitudId,
          programaId: solicitud.programaId,
          usuarioId,
          rolNombre,
          contenido: dto.contenido,
          tipo,
        },
        include: {
          usuario: { select: { id: true, nombre: true, apellido: true } },
        },
      });

      // Docente envía RESPUESTA → reactivar solicitud a EN_REVISION y notificar directivos
      if (tipo === 'RESPUESTA' && docenteId) {
        // Verificar que el programa sigue al 100% antes de reenviar
        const progActual = await (tx as any).programaAsignatura.findUnique({
          where: { id: solicitud.programaId },
        });
        if (progActual) {
          const estadosAct = calcEstadoSecciones(progActual as unknown as Record<string, unknown>);
          const todasCompletasAct = Object.values(estadosAct).every(v => v === 'COMPLETO');
          if (!todasCompletasAct) {
            throw new BadRequestException(
              'El programa debe estar al 100% de completitud antes de reenviar para revisión',
            );
          }
        }

        // Reactivar la solicitud
        await (tx as any).solicitudAprobacionPrograma.update({
          where: { id: solicitudId },
          data: { estado: 'PENDIENTE_APROBACION', fechaResolucion: null },
        });

        // Historial de la respuesta
        await (tx as any).historialPrograma.create({
          data: {
            programaId: solicitud.programaId,
            usuarioId,
            accion: 'ACTUALIZACION',
            descripcion: 'Docente respondió y reenvió el programa para revisión',
          },
        });

        // Marcar notificación de correcciones como leída para el docente
        await tx.notificacion.updateMany({
          where: { docenteId, solicitudProgramaId: solicitudId, leida: false },
          data: { leida: true, fechaLectura: new Date() },
        });

        // Notificar a directivos autorizados sobre el reenvío
        await this.notificarDirectivos(
          tx,
          solicitudId,
          solicitud.programa.materiaId,
          'RESPUESTA_DOCENTE',
        );
      }

      return nuevo;
    });

    return mensaje;
  }

  async marcarMensajesLeidos(solicitudId: string, usuarioId: string, rolNombre: string) {
    const { docenteId } = await this.verificarAccesoConversacion(solicitudId, usuarioId, rolNombre);

    const tipoLeer = rolNombre === 'DOCENTE' ? 'CORRECCION' : 'RESPUESTA';
    const ahora = new Date();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.mensajeCorrecionPrograma.updateMany({
        where: { solicitudId, tipo: tipoLeer, leido: false },
        data: { leido: true, fechaLectura: ahora },
      });

      // Si DOCENTE lee: marcar también la notificación CORRECCIONES_PROGRAMA como leída
      if (rolNombre === 'DOCENTE' && docenteId) {
        await tx.notificacion.updateMany({
          where: { docenteId, solicitudProgramaId: solicitudId, leida: false },
          data: { leida: true, fechaLectura: ahora },
        });
      }
    });

    return { ok: true };
  }

  async obtenerCorrecionesDocente(usuarioId: string) {
    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!docente) throw new ForbiddenException('Sin perfil docente asociado');

    const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
      where: { docenteId: docente.id, estado: 'APROBADA' },
      select: { materiaId: true },
    });
    const materiaIds = vinculaciones.map(v => v.materiaId);
    if (!materiaIds.length) return [];

    return this.prisma.solicitudAprobacionPrograma.findMany({
      where: {
        estado: 'CORRECCIONES_SOLICITADAS',
        programa: { materiaId: { in: materiaIds } },
      },
      include: {
        programa: {
          include: {
            materia: {
              include: {
                planEstudio: {
                  include: { carrera: { include: { facultad: true } } },
                },
              },
            },
          },
        },
        aprobador: { select: { id: true, nombre: true, apellido: true } },
        mensajes: {
          where: { tipo: 'CORRECCION', leido: false },
          select: { id: true },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  // ── Historial completo compartido entre directivos ───────────────────────────

  async obtenerHistorialPrograma(materiaId: string, usuarioId: string, rolNombre: string) {
    if (rolNombre === 'DIRECTOR_CARRERA' || rolNombre === 'DECANO') {
      const carreraId = await this.resolverCarreraDeMateria(materiaId);
      const tieneScope = await this.scopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId);
      if (!tieneScope) {
        throw new ForbiddenException('Sin acceso: la materia no pertenece a tu carrera o facultad asignada');
      }
    }

    if (rolNombre === 'DOCENTE') {
      const docente = await this.prisma.docente.findUnique({
        where: { usuarioId },
        select: { id: true },
      });
      if (!docente) throw new ForbiddenException('Sin perfil docente asociado');
      const vinc = await this.prisma.vinculacionCatedra.findFirst({
        where: { docenteId: docente.id, materiaId, estado: 'APROBADA' },
        select: { id: true },
      });
      if (!vinc) throw new ForbiddenException('No tenés una vinculación aprobada con esta asignatura');
    }

    const programa = await this.prisma.programaAsignatura.findUnique({
      where: { materiaId },
      include: {
        historial: {
          include: {
            usuario: { select: { id: true, nombre: true, apellido: true } },
          },
          orderBy: { fecha: 'desc' },
        },
        solicitudes: {
          orderBy: { fechaCreacion: 'desc' },
          include: {
            aprobador: { select: { id: true, nombre: true, apellido: true } },
            mensajes: {
              include: {
                usuario: { select: { id: true, nombre: true, apellido: true } },
              },
              orderBy: { fechaCreacion: 'asc' },
            },
          },
        },
      },
    });

    if (!programa) return { historial: [], solicitudes: [] };
    return {
      historial: (programa as any).historial ?? [],
      solicitudes: (programa as any).solicitudes ?? [],
    };
  }

  // ── Notificaciones a directivos (C13) ────────────────────────────────────────

  private async notificarDirectivos(
    tx: Prisma.TransactionClient,
    solicitudId: string,
    materiaId: string,
    tipo: string,
  ) {
    const materia = await (tx as any).materia.findUnique({
      where: { id: materiaId },
      include: {
        planEstudio: {
          include: {
            carrera: { include: { facultad: { select: { id: true, nombre: true } } } },
          },
        },
      },
    });
    if (!materia) return;

    const carreraId: string = materia.planEstudio?.carreraId ?? '';
    const facultadId: string = materia.planEstudio?.carrera?.facultad?.id ?? '';
    const materiaNombre: string = materia.nombre ?? '';
    const carreraNombre: string = materia.planEstudio?.carrera?.nombre ?? '';
    const planNombre: string = materia.planEstudio?.nombre ?? '';

    const directivos = await (tx as any).usuario.findMany({
      where: {
        activo: true,
        rol: { nombre: { in: ['SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA', 'DECANO', 'RECTORADO'] } },
      },
      include: {
        rol:               { select: { nombre: true } },
        carrerasAsociadas: { select: { carreraId: true } },
        facultadesAsociadas: { select: { facultadId: true } },
      },
    });

    const cuerpo = JSON.stringify({
      solicitudId,
      materiaId,
      materia: materiaNombre,
      carrera: carreraNombre,
      plan: planNombre,
      estado: 'EN_REVISION',
      fechaSolicitud: new Date().toISOString(),
    });

    const notificados = new Set<string>();

    for (const u of directivos) {
      const rol = u.rol?.nombre ?? '';
      const enScope =
        rol === 'SECRETARIA_ACADEMICA' || rol === 'RECTORADO'
          ? true
          : rol === 'DIRECTOR_CARRERA'
            ? u.carrerasAsociadas.some((a: { carreraId: string }) => a.carreraId === carreraId)
            : rol === 'DECANO'
              ? u.facultadesAsociadas.some((a: { facultadId: string }) => a.facultadId === facultadId)
              : false;

      if (!enScope || notificados.has(u.id)) continue;
      notificados.add(u.id);

      const existente = await (tx as any).notificacion.findFirst({
        where: { usuarioId: u.id, solicitudProgramaId: solicitudId, leida: false },
      });
      if (!existente) {
        await (tx as any).notificacion.create({
          data: {
            tipo,
            titulo: `Programa pendiente de aprobación: ${materiaNombre}`,
            cuerpo,
            usuarioId: u.id,
            solicitudProgramaId: solicitudId,
          },
        });
      }
    }
  }

  // ── Regularización de programas existentes (C13) ─────────────────────────────

  async listarProgramasParaRegularizacion(usuarioId: string, rolNombre: string) {
    const carrerasEnScope = await this.scopeService.getCarrerasEnScope(usuarioId, rolNombre);

    const where: any = {
      estadoPrograma:  { not: 'APROBADO' },
      estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
      estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
      solicitudes: {
        none: { estado: { in: ['PENDIENTE_APROBACION', 'CORRECCIONES_SOLICITADAS'] } },
      },
    };

    if (carrerasEnScope !== null) {
      where.materia = { planEstudio: { carreraId: { in: carrerasEnScope } } };
    }

    const programas = await this.prisma.programaAsignatura.findMany({
      where,
      include: {
        materia: {
          include: {
            planEstudio: {
              include: { carrera: { include: { facultad: true } } },
            },
          },
        },
        solicitudes: {
          orderBy: { fechaCreacion: 'desc' },
          take: 1,
          select: { id: true, estado: true, fechaCreacion: true },
        },
      },
      orderBy: { fechaActualizacion: 'desc' },
    });

    return {
      cantidad: programas.length,
      descripcion:
        'Programas al 100% sin solicitud activa ni aprobación vigente que requieren incorporarse al circuito de aprobación',
      mecanismoReversion:
        'Las solicitudes generadas pueden invalidarse manualmente por un directivo con scope. Los programas no son modificados.',
      requiereConfirmacion: true,
      programas: programas.map(p => ({
        id: p.id,
        materiaId: p.materiaId,
        materiaNombre: (p.materia as any)?.nombre ?? '',
        carrera: (p.materia as any)?.planEstudio?.carrera?.nombre ?? '',
        facultad: (p.materia as any)?.planEstudio?.carrera?.facultad?.nombre ?? '',
        plan: (p.materia as any)?.planEstudio?.nombre ?? '',
        estadoPrograma: p.estadoPrograma,
        ultimaSolicitud: (p as any).solicitudes?.[0] ?? null,
      })),
    };
  }

  // ── Generación de solicitudes para programas históricos (C16.2) ──────────────

  async generarSolicitudesRegularizacion(dto: GenerarRegularizacionDto, usuarioId: string) {
    type DetalleItem = {
      programaId: string;
      materiaNombre: string;
      codigo: string;
      resultado: 'GENERADA' | 'OMITIDO';
      solicitudId?: string;
      motivoOmision?: string;
    };

    const detalle: DetalleItem[] = [];

    for (const programaId of dto.programaIds) {
      const programa = await this.prisma.programaAsignatura.findUnique({
        where: { id: programaId },
        include: {
          materia: { select: { id: true, nombre: true, codigo: true } },
          solicitudes: {
            where: { estado: { in: ['PENDIENTE_APROBACION', 'CORRECCIONES_SOLICITADAS'] } },
            take: 1,
            select: { id: true, estado: true },
          },
        },
      });

      if (!programa) throw new NotFoundException(`Programa ${programaId} no encontrado`);

      const materiaNombre: string = (programa as any).materia?.nombre ?? '';
      const codigo: string         = (programa as any).materia?.codigo ?? '';

      // Validación previa a la transacción (early rejection)
      const estadoSecciones = calcEstadoSecciones(programa as unknown as Record<string, unknown>);
      const todasCompletas  = Object.values(estadoSecciones).every(v => v === 'COMPLETO');

      if (programa.estadoPrograma === 'APROBADO') {
        detalle.push({ programaId, materiaNombre, codigo, resultado: 'OMITIDO', motivoOmision: 'El programa ya está aprobado' });
        continue;
      }
      if (!todasCompletas) {
        detalle.push({ programaId, materiaNombre, codigo, resultado: 'OMITIDO', motivoOmision: 'El programa no está completo al 100%' });
        continue;
      }
      const solicitudActiva: { id: string; estado: string } | undefined = (programa as any).solicitudes?.[0];
      if (solicitudActiva?.estado === 'PENDIENTE_APROBACION') {
        detalle.push({ programaId, materiaNombre, codigo, resultado: 'OMITIDO', motivoOmision: 'Ya existe una solicitud activa PENDIENTE_APROBACION', solicitudId: solicitudActiva.id });
        continue;
      }
      if (solicitudActiva?.estado === 'CORRECCIONES_SOLICITADAS') {
        detalle.push({ programaId, materiaNombre, codigo, resultado: 'OMITIDO', motivoOmision: 'El programa tiene un ciclo de correcciones activo' });
        continue;
      }

      // Transacción: re-verificar y crear (protección contra concurrencia)
      const txResult = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Bloqueo por fila: serializa regularizaciones concurrentes del mismo programa.
        // La segunda transacción espera aquí hasta que la primera confirme o revierta,
        // luego el findFirst ve la solicitud ya creada y retorna OMITIDO.
        await tx.$queryRaw`SELECT id FROM "ProgramaAsignatura" WHERE id = ${programaId} FOR UPDATE`;

        // Re-verificar dentro de la transacción: protege contra solicitudes duplicadas concurrentes
        const existente = await tx.solicitudAprobacionPrograma.findFirst({
          where: { programaId, estado: { in: ['PENDIENTE_APROBACION', 'CORRECCIONES_SOLICITADAS'] } },
          select: { id: true, estado: true },
        });
        if (existente) {
          return { omitido: true as const, motivo: `Solicitud creada concurrentemente: ${existente.estado}`, solicitudId: existente.id };
        }

        const progActual = await tx.programaAsignatura.findUnique({ where: { id: programaId } });
        if (progActual?.estadoPrograma === 'APROBADO') {
          return { omitido: true as const, motivo: 'El programa fue aprobado durante la transacción' };
        }
        const estadoTx = calcEstadoSecciones(progActual as unknown as Record<string, unknown>);
        if (!Object.values(estadoTx).every(v => v === 'COMPLETO')) {
          return { omitido: true as const, motivo: 'El programa dejó de estar completo durante la transacción' };
        }

        const nueva = await tx.solicitudAprobacionPrograma.create({
          data: { programaId, estado: 'PENDIENTE_APROBACION' },
        });

        await tx.historialPrograma.create({
          data: {
            programaId,
            usuarioId,
            accion: 'REGULARIZACION_HISTORICA',
            descripcion: `Regularización histórica. Programa incorporado al circuito de aprobación. Solicitud: ${nueva.id}`,
          },
        });

        await this.notificarDirectivos(tx, nueva.id, programa.materiaId, 'NUEVA_SOLICITUD_APROBACION');

        return { omitido: false as const, solicitudId: nueva.id };
      });

      if (txResult.omitido) {
        detalle.push({
          programaId, materiaNombre, codigo, resultado: 'OMITIDO',
          motivoOmision: txResult.motivo,
          ...(txResult.solicitudId ? { solicitudId: txResult.solicitudId } : {}),
        });
      } else {
        detalle.push({ programaId, materiaNombre, codigo, resultado: 'GENERADA', solicitudId: txResult.solicitudId });
      }
    }

    return {
      procesados:          dto.programaIds.length,
      solicitudesGeneradas: detalle.filter(d => d.resultado === 'GENERADA').length,
      omitidos:            detalle.filter(d => d.resultado === 'OMITIDO').length,
      detalle,
    };
  }

  async contadoresNovedades(usuarioId: string, rolNombre: string) {
    if (rolNombre === 'DOCENTE') {
      const docente = await this.prisma.docente.findUnique({
        where: { usuarioId },
        select: { id: true },
      });
      if (!docente) return { correcciones: 0 };

      const vinculaciones = await this.prisma.vinculacionCatedra.findMany({
        where: { docenteId: docente.id, estado: 'APROBADA' },
        select: { materiaId: true },
      });
      const materiaIds = vinculaciones.map(v => v.materiaId);
      if (!materiaIds.length) return { correcciones: 0 };

      const correcciones = await this.prisma.mensajeCorrecionPrograma.count({
        where: {
          tipo: 'CORRECCION',
          leido: false,
          solicitud: {
            programa: { materiaId: { in: materiaIds } },
          },
        },
      });
      return { correcciones };
    }

    if ((ROLES_APROBADOR as readonly string[]).includes(rolNombre)) {
      const carrerasEnScope = await this.scopeService.getCarrerasEnScope(usuarioId, rolNombre);

      const whereMsg: Record<string, unknown> =
        carrerasEnScope === null
          ? {}
          : {
              solicitud: {
                programa: {
                  materia: { planEstudio: { carreraId: { in: carrerasEnScope } } },
                },
              },
            };

      const correcciones = await this.prisma.mensajeCorrecionPrograma.count({
        where: { tipo: 'RESPUESTA', leido: false, ...whereMsg },
      });
      return { correcciones };
    }

    return { correcciones: 0 };
  }
}
