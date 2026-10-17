import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface AlertaMateria {
  materiaId: string;
  nombre: string;
  codigo: string;
  /** true si la materia tiene al menos una VinculacionCatedra con estado='APROBADA'. */
  tieneVinculacionesAprobadas: boolean;
}

/**
 * Valor del indicador R-08 para un plan de estudios.
 *
 * - materiasConAlerta: confirmadas sin responsable
 *   (sin APROBADAS, o todas APROBADAS con esResponsableCatedra=false)
 * - materiasInciertas: tienen APROBADAS pero con esResponsableCatedra=null
 *   (no puede afirmarse ausencia de responsable; contribuyen al estado PARCIAL)
 * - totalMaterias: cantidad total de materias evaluadas
 * - totalConResponsable: materias con APROBADA+true confirmado
 */
export interface ResultadoR08 {
  materiasConAlerta: AlertaMateria[];
  materiasInciertas: AlertaMateria[];
  totalMaterias: number;
  totalConResponsable: number;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-08: Materias sin responsable de cátedra.
 *
 * Definición funcional (MOD-AUT G-13 + FSD_MODAUT_v1_1):
 *   Responsable efectivo = VinculacionCatedra con estado='APROBADA' y esResponsableCatedra=true.
 *
 * Clasificación por materia:
 *   TIENE_RESPONSABLE: ≥1 APROBADA con esResponsableCatedra=true              → no alerta
 *   SIN_RESPONSABLE:   sin APROBADAS, o todas APROBADAS con false             → materiasConAlerta
 *   INCIERTO:          APROBADAS existen, ninguna con true, ≥1 con null       → materiasInciertas
 *
 * Parámetro obligatorio:
 *   planEstudioId es requerido. Si no está presente en el contexto, se lanza
 *   BadRequestException — no es un estado NO_APLICA, es un contexto inválido.
 *   Los controles de autorización (rol + scope) se realizan en IndicadoresService
 *   antes de que el evaluador reciba el contexto.
 *
 * Estado del plan:
 *   NO_APLICA:  plan autorizado pero sin materias (comportamiento temporal documentado)
 *   CALCULADO:  ninguna materia en estado INCIERTO
 *   PARCIAL:    ≥1 materia en estado INCIERTO
 *
 * Materias inactivas:
 *   R-08 evalúa todas las materias asociadas al plan independientemente de su
 *   estado (ACTIVO, INACTIVO, etc.). Si la especificación funcional establece un
 *   criterio de exclusión, requiere decisión institucional antes de implementarse.
 *
 * Restricciones:
 *   - esResponsableCatedra=null nunca se asume false.
 *   - PENDIENTE/RECHAZADA/DESVINCULADA no constituyen responsable, aunque tengan true.
 *   - No se exponen datos personales del docente.
 *   - No se modifican vinculaciones ni datos académicos.
 */
@Injectable()
export class R08EvaluadorService implements IndicadorEvaluador<ResultadoR08> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR08>> {
    if (!contexto.planEstudioId) {
      // planEstudioId es un parámetro obligatorio de R-08, no un contexto opcional.
      // NO_APLICA es para cuando la regla no corresponde al contexto institucional,
      // no para parámetros de entrada ausentes.
      throw new BadRequestException(
        'R-08 requiere planEstudioId. Proporcione el identificador del plan a evaluar.',
      );
    }

    const [materias, vinculaciones] = await Promise.all([
      this.consultas.obtenerMateriasDePlan(
        contexto.planEstudioId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
      this.consultas.obtenerVinculacionesDePlan(
        contexto.planEstudioId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
    ]);

    if (materias.length === 0) {
      return {
        codigo: 'R-08',
        contextoId: contexto.planEstudioId,
        tipoContexto: 'PLAN',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          materiasConAlerta: [],
          materiasInciertas: [],
          totalMaterias: 0,
          totalConResponsable: 0,
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    // Indexar vinculaciones APROBADAS por materiaId (los otros estados no son efectivos)
    const vinsPorMateria = new Map<string, Array<{ esResponsableCatedra: boolean | null }>>();
    for (const v of vinculaciones) {
      if (v.estado === 'APROBADA') {
        const lista = vinsPorMateria.get(v.materiaId) ?? [];
        lista.push({ esResponsableCatedra: v.esResponsableCatedra });
        vinsPorMateria.set(v.materiaId, lista);
      }
    }

    const materiasConAlerta: AlertaMateria[] = [];
    const materiasInciertas: AlertaMateria[] = [];
    let totalConResponsable = 0;

    for (const materia of materias) {
      const vinsAprobadas = vinsPorMateria.get(materia.id) ?? [];
      const tieneResponsable = vinsAprobadas.some((v) => v.esResponsableCatedra === true);

      if (tieneResponsable) {
        totalConResponsable++;
        continue;
      }

      const tieneNulls = vinsAprobadas.some((v) => v.esResponsableCatedra === null);
      const entry: AlertaMateria = {
        materiaId: materia.id,
        nombre: materia.nombre,
        codigo: materia.codigo,
        tieneVinculacionesAprobadas: vinsAprobadas.length > 0,
      };

      if (tieneNulls) {
        materiasInciertas.push(entry);
      } else {
        materiasConAlerta.push(entry);
      }
    }

    const estadoCalculo =
      materiasInciertas.length > 0 ? EstadoCalculo.PARCIAL : EstadoCalculo.CALCULADO;

    const datosFaltantes: DatoFaltante[] = [];
    if (materiasInciertas.length > 0) {
      datosFaltantes.push({
        campo: 'esResponsableCatedra',
        entidad: 'VinculacionCatedra',
        descripcion:
          `${materiasInciertas.length} materia(s) tienen vinculaciones APROBADAS con ` +
          `esResponsableCatedra sin clasificar (null). La ausencia de responsable no puede confirmarse.`,
      });
    }

    return {
      codigo: 'R-08',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        materiasConAlerta,
        materiasInciertas,
        totalMaterias: materias.length,
        totalConResponsable,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
