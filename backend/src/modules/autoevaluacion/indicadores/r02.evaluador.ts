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

/**
 * Par (materia, cátedra) con doble responsable confirmado.
 * cantidadResponsables >= 2 siempre.
 */
export interface AlertaR02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  /** Número de VinculacionCatedra APROBADAS con esResponsableCatedra=true. Siempre >= 2. */
  cantidadResponsables: number;
}

/**
 * Par (materia, cátedra) con estado incierto:
 * confirmedTrue < 2 pero confirmedTrue + sinClasificar >= 2.
 * No puede afirmarse ausencia de doble responsable.
 */
export interface ParIncierto02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  /** Número de APROBADAS con esResponsableCatedra=true (0 o 1). */
  confirmedTrue: number;
  /** Número de APROBADAS con esResponsableCatedra=null. */
  sinClasificar: number;
}

/**
 * Valor del indicador R-02 para un plan de estudios.
 *
 * - paresConAlerta: pares (materia, cátedra) con doble responsable confirmado
 * - paresInciertos: pares con datos insuficientes para descartar doble responsable
 * - totalMaterias: total de materias del plan evaluado
 */
export interface ResultadoR02 {
  paresConAlerta: AlertaR02[];
  paresInciertos: ParIncierto02[];
  totalMaterias: number;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-02: Doble responsable de cátedra.
 *
 * Fuente funcional: prototipo Modulo_Autoevaluacion_v5_1.html, función responsables() +
 * agrupación por cátedra (líneas 338-390).
 *
 * Definición:
 *   Una alerta R-02 existe cuando, para un par (materiaId, catedraId),
 *   hay dos o más VinculacionCatedra con estado='APROBADA' y esResponsableCatedra=true.
 *
 * Unidad de evaluación: (materiaId, catedraId).
 *   Dos responsables en cátedras distintas para la misma materia NO constituyen R-02.
 *
 * Clasificación por par (materia, cátedra):
 *   nTrue = count(APROBADA + esResponsableCatedra=true)
 *   nNull = count(APROBADA + esResponsableCatedra=null)
 *
 *   nTrue >= 2                         → paresConAlerta (doble confirmado)
 *   nTrue < 2 AND nTrue + nNull >= 2   → paresInciertos (posible doble, null sin clasificar)
 *   nTrue < 2 AND nTrue + nNull < 2    → sin doble (no relevante para R-02)
 *
 * Relación con el índice parcial único (VinculacionCatedra_responsable_materia_catedra_unique):
 *   El índice, cuando está aplicado, impide nTrue >= 2 para nuevas escrituras.
 *   R-02 detecta anomalías en datos históricos o anteriores a la aplicación del índice.
 *
 * Estado del plan:
 *   NO_APLICA:  planEstudioId ausente (ver BadRequestException) o plan sin materias
 *   CALCULADO:  ningún par en estado INCIERTO
 *   PARCIAL:    ≥1 par en estado INCIERTO
 *
 * Parámetro obligatorio:
 *   planEstudioId es requerido. Si no está presente, se lanza BadRequestException.
 *
 * Datos personales:
 *   No se incluyen DNI, correo electrónico ni nombre de docente en el resultado.
 */
@Injectable()
export class R02EvaluadorService implements IndicadorEvaluador<ResultadoR02> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR02>> {
    if (!contexto.planEstudioId) {
      throw new BadRequestException(
        'R-02 requiere planEstudioId. Proporcione el identificador del plan a evaluar.',
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
        codigo: 'R-02',
        contextoId: contexto.planEstudioId,
        tipoContexto: 'PLAN',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: { paresConAlerta: [], paresInciertos: [], totalMaterias: 0 },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    // Índice rápido de materias para acceder nombre/código
    const materiasMap = new Map(materias.map((m) => [m.id, m]));

    // Conteo por par (materiaId, catedraId) — solo APROBADAS
    // clave compuesta: `${materiaId}::${catedraId}`
    type ConteosPar = { nTrue: number; nNull: number; materiaId: string; catedraId: string };
    const pares = new Map<string, ConteosPar>();

    for (const v of vinculaciones) {
      if (v.estado !== 'APROBADA') continue;

      const clave = `${v.materiaId}::${v.catedraId}`;
      const existing: ConteosPar = pares.get(clave) ?? {
        nTrue: 0,
        nNull: 0,
        materiaId: v.materiaId,
        catedraId: v.catedraId,
      };

      if (v.esResponsableCatedra === true) existing.nTrue++;
      else if (v.esResponsableCatedra === null) existing.nNull++;
      // false → confirmado no-responsable, no contribuye al conteo de posibles dobles

      pares.set(clave, existing);
    }

    const paresConAlerta: AlertaR02[] = [];
    const paresInciertos: ParIncierto02[] = [];

    for (const { nTrue, nNull, materiaId, catedraId } of pares.values()) {
      const materia = materiasMap.get(materiaId);
      if (!materia) continue;

      if (nTrue >= 2) {
        paresConAlerta.push({
          materiaId,
          materiaNombre: materia.nombre,
          materiaCodigo: materia.codigo,
          catedraId,
          cantidadResponsables: nTrue,
        });
      } else if (nTrue + nNull >= 2) {
        // nTrue < 2 pero el total de true + null >= 2 → no puede descartarse doble
        paresInciertos.push({
          materiaId,
          materiaNombre: materia.nombre,
          materiaCodigo: materia.codigo,
          catedraId,
          confirmedTrue: nTrue,
          sinClasificar: nNull,
        });
      }
    }

    const estadoCalculo =
      paresInciertos.length > 0 ? EstadoCalculo.PARCIAL : EstadoCalculo.CALCULADO;

    const datosFaltantes: DatoFaltante[] = [];
    if (paresInciertos.length > 0) {
      datosFaltantes.push({
        campo: 'esResponsableCatedra',
        entidad: 'VinculacionCatedra',
        descripcion:
          `${paresInciertos.length} par(es) (materia, cátedra) tienen vinculaciones APROBADAS ` +
          `con esResponsableCatedra sin clasificar. No puede confirmarse ausencia de doble responsable.`,
      });
    }

    return {
      codigo: 'R-02',
      contextoId: contexto.planEstudioId,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: { paresConAlerta, paresInciertos, totalMaterias: materias.length },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
