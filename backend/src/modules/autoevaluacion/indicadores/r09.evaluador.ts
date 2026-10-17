import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigPlanService } from '../config/config-plan.service';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import type { BloqueNormalizado } from '../consultas-academicas/consultas-academicas.types';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

/** Identificación mínima de una materia para evidencia, sin datos personales. */
export interface MateriaResumenR09 {
  materiaId: string;
  nombre: string;
  codigo: string;
  /** Conservado para trazabilidad cuando el bloque es indeterminado */
  bloqueConocimientoRaw?: string | null;
}

/**
 * Resultado de comparar horas reales con el umbral mínimo configurado para una dimensión.
 *
 * null en cualquier campo indica datos insuficientes o umbral no configurado.
 * La diferencia conserva su signo (negativa = incumplimiento).
 */
export interface EvaluacionDimension {
  /** null si hubo materias sin cargaHorariaTotal en esta dimensión */
  horasReales: number | null;
  /** null si el umbral no fue configurado en PlanEstudio (campo = NULL) */
  horasMinimas: number | null;
  /** horasReales − horasMinimas. Negativa = faltan horas. null si alguno es null. */
  diferencia: number | null;
  /** true = cumple el mínimo, false = no cumple, null = no determinable */
  cumple: boolean | null;
}

/**
 * Valor del indicador R-09 para un plan de estudios.
 *
 * Fuente de horas: cargaHorariaTotal de cada Materia (horas totales de la asignatura,
 * no semanales). Se suma por plan y por bloque curricular normalizado.
 *
 * Los campos nullable no se convierten en cero.
 */
export interface ResultadoR09 {
  planEstudioId: string;
  totalMaterias: number;
  /** Materias del plan sin cargaHorariaTotal registrada */
  materiasSinHoras: MateriaResumenR09[];
  /**
   * Materias con bloqueConocimiento ausente (null) o con código no reconocido
   * por normalizarBloque(). Sus horas están en horasTotal pero no en horasPorBloque.
   */
  materiasConBloqueIndeterminado: MateriaResumenR09[];
  /**
   * Suma de cargaHorariaTotal de todas las materias.
   * null si alguna materia tiene cargaHorariaTotal = null.
   */
  horasTotal: number | null;
  /**
   * Horas acumuladas por bloque curricular normalizado.
   * null si la suma de ese bloque no puede determinarse con exactitud.
   */
  horasPorBloque: {
    CB: number | null;
    TB: number | null;
    TA: number | null;
    CX: number | null;
  };
  evaluaciones: {
    total: EvaluacionDimension;
    CB: EvaluacionDimension;
    TB: EvaluacionDimension;
    TA: EvaluacionDimension;
    /** CX corresponde al campo horasMinCTX del plan de estudio */
    CX: EvaluacionDimension;
  };
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

const BLOQUES_CONOCIDOS: BloqueNormalizado[] = ['CB', 'TB', 'TA', 'CX'];

function evalDimension(horasReales: number | null, horasMinimas: number | null): EvaluacionDimension {
  if (horasMinimas === null) {
    // Umbral no configurado: la dimensión no se evalúa.
    return { horasReales, horasMinimas: null, diferencia: null, cumple: null };
  }
  if (horasReales === null) {
    return { horasReales: null, horasMinimas, diferencia: null, cumple: null };
  }
  const diferencia = horasReales - horasMinimas;
  return { horasReales, horasMinimas, diferencia, cumple: diferencia >= 0 };
}

/**
 * Evaluador de R-09: Control de umbrales horarios del plan de estudio.
 *
 * Fuente funcional: prototipo Modulo_Autoevaluacion_v5_1.html, función calcAlerts()
 * (líneas 376-382) y datos PLANES[].total / PLANES[].bloques.
 *
 * Definición:
 *   El plan debe superar las horas mínimas totales y las de cada bloque curricular
 *   (CB, TB, TA, CX). Se compara la suma de cargaHorariaTotal de las materias del plan
 *   con los umbrales configurados en los campos horasMin* de PlanEstudio.
 *
 * Unidad de medida: horas totales de la asignatura (cargaHorariaTotal), no semanales.
 *
 * Umbrales NULL:
 *   Un umbral NULL significa "no configurado" según el comentario del schema Prisma
 *   (MOD-AUT G-04) y el tipo UmbralesAut. R-09 no evalúa esa dimensión.
 *   NULL no se trata como mínimo de cero horas.
 *
 * Materias sin cargaHorariaTotal:
 *   Sus horas son desconocidas → total e incertidumbre propagados al bloque.
 *   Se registran en materiasSinHoras y en datosFaltantes.
 *
 * Materias con bloque indeterminado (null):
 *   Sus horas van al total pero no pueden clasificarse por bloque.
 *   Si tienen horas > 0, todos los totales por bloque son inciertos.
 *   Se registran en materiasConBloqueIndeterminado.
 *
 * Estados:
 *   NO_APLICA:       plan sin materias.
 *   NO_DETERMINABLE: todas las materias tienen cargaHorariaTotal = null.
 *   PARCIAL:         algunas materias sin horas o con bloques indeterminados con horas > 0.
 *   CALCULADO:       todas las materias tienen horas y bloques clasificados.
 *
 * Parámetro obligatorio:
 *   planEstudioId es requerido. Si no está presente, se lanza BadRequestException.
 *
 * Seguridad:
 *   La validación de rol y scope la realiza IndicadoresService antes de llamar a evaluar().
 *   ConsultasAcademicasService y ConfigPlanService re-validan scope internamente.
 */
@Injectable()
export class R09EvaluadorService implements IndicadorEvaluador<ResultadoR09> {
  constructor(
    private readonly consultas: ConsultasAcademicasService,
    private readonly configPlan: ConfigPlanService,
  ) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR09>> {
    if (!contexto.planEstudioId) {
      throw new BadRequestException(
        'R-09 requiere planEstudioId. Proporcione el identificador del plan a evaluar.',
      );
    }

    const [materias, umbrales] = await Promise.all([
      this.consultas.obtenerMateriasDePlan(
        contexto.planEstudioId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
      this.configPlan.obtenerUmbrales(
        contexto.planEstudioId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
    ]);

    if (materias.length === 0) {
      return {
        codigo: 'R-09',
        contextoId: contexto.planEstudioId,
        tipoContexto: 'PLAN',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          planEstudioId: contexto.planEstudioId,
          totalMaterias: 0,
          materiasSinHoras: [],
          materiasConBloqueIndeterminado: [],
          horasTotal: null,
          horasPorBloque: { CB: null, TB: null, TA: null, CX: null },
          evaluaciones: {
            total: evalDimension(null, umbrales.horasMinTotales),
            CB: evalDimension(null, umbrales.horasMinCB),
            TB: evalDimension(null, umbrales.horasMinTB),
            TA: evalDimension(null, umbrales.horasMinTA),
            CX: evalDimension(null, umbrales.horasMinCTX),
          },
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    // ── Acumulación ──────────────────────────────────────────────────────────

    const materiasSinHoras: MateriaResumenR09[] = [];
    const materiasConBloqueIndeterminado: MateriaResumenR09[] = [];

    // Acumuladores de horas por bloque
    const sumaBloque: Record<string, number> = { CB: 0, TB: 0, TA: 0, CX: 0 };
    // Flags de incertidumbre por bloque
    const bloqueIncierto: Record<string, boolean> = { CB: false, TB: false, TA: false, CX: false };

    let sumaTotal = 0;
    let totalIncierto = false;
    // true cuando alguna materia con bloqueNormalizado=null tiene cargaHorariaTotal > 0
    let hayBloqueConHorasIndeterminadas = false;

    for (const m of materias) {
      const sinHoras = m.cargaHorariaTotal === null;
      const sinBloque = m.bloqueNormalizado === null;

      // Materias con bloque indeterminado (independientemente de las horas)
      if (sinBloque) {
        materiasConBloqueIndeterminado.push({
          materiaId: m.id,
          nombre: m.nombre,
          codigo: m.codigo,
          bloqueConocimientoRaw: m.bloqueConocimientoRaw,
        });
      }

      if (sinHoras) {
        materiasSinHoras.push({ materiaId: m.id, nombre: m.nombre, codigo: m.codigo });
        totalIncierto = true;
        // El bloque de esta materia (si es conocido) también tiene horas inciertas
        if (!sinBloque) {
          bloqueIncierto[m.bloqueNormalizado!] = true;
        } else {
          // Bloque desconocido + horas desconocidas → todos los bloques inciertos
          for (const b of BLOQUES_CONOCIDOS) bloqueIncierto[b as string] = true;
        }
      } else {
        // cargaHorariaTotal no es null
        sumaTotal += m.cargaHorariaTotal!;

        if (!sinBloque) {
          sumaBloque[m.bloqueNormalizado!] += m.cargaHorariaTotal!;
        } else if (m.cargaHorariaTotal! > 0) {
          // Horas positivas sin bloque clasificado → no sabemos a qué bloque asignarlas
          hayBloqueConHorasIndeterminadas = true;
          for (const b of BLOQUES_CONOCIDOS) bloqueIncierto[b as string] = true;
        }
        // cargaHorariaTotal = 0 con sinBloque: contribuye 0 a cualquier bloque → sin incertidumbre
      }
    }

    // ── Resultados ───────────────────────────────────────────────────────────

    const horasTotal = totalIncierto ? null : sumaTotal;
    const horasPorBloque = {
      CB: bloqueIncierto['CB'] ? null : sumaBloque['CB'],
      TB: bloqueIncierto['TB'] ? null : sumaBloque['TB'],
      TA: bloqueIncierto['TA'] ? null : sumaBloque['TA'],
      CX: bloqueIncierto['CX'] ? null : sumaBloque['CX'],
    };

    // ── Estado de cálculo ────────────────────────────────────────────────────

    let estadoCalculo: EstadoCalculo;
    if (materiasSinHoras.length === materias.length) {
      estadoCalculo = EstadoCalculo.NO_DETERMINABLE;
    } else if (materiasSinHoras.length > 0 || hayBloqueConHorasIndeterminadas) {
      estadoCalculo = EstadoCalculo.PARCIAL;
    } else {
      estadoCalculo = EstadoCalculo.CALCULADO;
    }

    // ── Datos faltantes ──────────────────────────────────────────────────────

    const datosFaltantes: DatoFaltante[] = [];
    if (materiasSinHoras.length > 0) {
      datosFaltantes.push({
        campo: 'cargaHorariaTotal',
        entidad: 'Materia',
        descripcion:
          `${materiasSinHoras.length} materia(s) sin carga horaria total registrada. ` +
          `Las horas del plan pueden estar subestimadas.`,
      });
    }
    if (hayBloqueConHorasIndeterminadas) {
      datosFaltantes.push({
        campo: 'bloqueConocimiento',
        entidad: 'Materia',
        descripcion:
          `Existen materias con horas cargadas y bloque curricular ausente o desconocido. ` +
          `Las sumas por bloque no pueden determinarse con exactitud.`,
      });
    }

    return {
      codigo: 'R-09',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        planEstudioId: contexto.planEstudioId,
        totalMaterias: materias.length,
        materiasSinHoras,
        materiasConBloqueIndeterminado,
        horasTotal,
        horasPorBloque,
        evaluaciones: {
          total: evalDimension(horasTotal, umbrales.horasMinTotales),
          CB: evalDimension(horasPorBloque.CB, umbrales.horasMinCB),
          TB: evalDimension(horasPorBloque.TB, umbrales.horasMinTB),
          TA: evalDimension(horasPorBloque.TA, umbrales.horasMinTA),
          CX: evalDimension(horasPorBloque.CX, umbrales.horasMinCTX),
        },
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
