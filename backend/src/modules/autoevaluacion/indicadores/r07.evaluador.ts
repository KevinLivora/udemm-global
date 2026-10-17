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
 * Una combinación académica distinta contabilizada como "materia" del docente.
 * FSD §3.3: la unidad de conteo es (plan, asignatura, cátedra).
 * materiaNombre: nombre de la asignatura para presentación en orden alfabético (FSD §5.3).
 */
export interface AsignacionR07 {
  planEstudioId: string;
  materiaId: string;
  catedraId: string;
  materiaNombre?: string;
}

export interface DocenteAlertaR07 {
  docenteId: string;
  /** Nombre completo: docente.nombre + ' ' + docente.apellido */
  nombre: string;
  /** Cantidad de combinaciones distintas (planEstudioId, materiaId, catedraId). FSD §3.3. */
  nMaterias: number;
  exceso: number;             // nMaterias - limite (siempre > 0 para docentes en esta lista)
  asignaciones: AsignacionR07[]; // evidencia: combinaciones (plan, materia, cátedra) contabilizadas
}

/**
 * Docente cuyo cumplimiento R-07 no puede determinarse.
 * Causas posibles:
 *   CROSS_FACULTAD: tiene asignaciones en más de una facultad; sin un umbral unificado,
 *     no es posible evaluar si supera P-03 a nivel institucional.
 */
export interface DocenteNoDeterminableR07 {
  docenteId: string;
  nombre: string;
  /** Combinaciones conocidas en el alcance de esta facultad. Puede estar subestimado. */
  nMateriasConocidas: number;
  causa: 'CROSS_FACULTAD';
}

/**
 * Valor del indicador R-07 para una carrera / facultad.
 *
 * - limite: p03MaxMat configurado para la facultad; null cuando falta la config (NO_DETERMINABLE).
 * - sobreasignados: docentes con nMaterias > limite (solo los que pudieron evaluarse).
 * - noDeterminables: docentes con asignaciones cross-facultad (evaluación incompleta).
 * - alcanceFacultad: true si la evaluación cubrió todas las carreras de la facultad;
 *     false si solo cubrió la carrera solicitada (DIRECTOR_CARRERA → PARCIAL).
 */
export interface ResultadoR07 {
  carreraId: string;
  facultadId: string;
  limite: number | null;
  totalDocentes: number;
  totalSobreasignados: number;
  sobreasignados: DocenteAlertaR07[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR07[];
  alcanceFacultad: boolean;
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-07: Docentes sobre-asignados.
 *
 * Definición funcional (FSD MOD-AUT §3.3 y §5.3):
 *   Docente sobreasignado ↔ nMat(d) > p03MaxMat
 *   nMat = cantidad de combinaciones distintas (planEstudioId, materiaId, catedraId)
 *          entre vinculaciones APROBADAS de todas las carreras de la facultad.
 *          Dos cargos sobre la misma combinación cuentan una vez; la misma materia
 *          en dos cátedras distintas cuenta dos veces.
 *   p03MaxMat = parámetro institucional por facultad (AutoevaluacionConfigFacultad).
 *
 * Alcance: facultad completa (todas las carreras). Requiere carreraId para identificar la facultad.
 * Excepción de alcance: DIRECTOR_CARRERA solo accede a su carrera → resultado PARCIAL.
 *
 * Tratamiento de docentes cross-facultad:
 *   Si un docente tiene asignaciones APROBADAS en más de una facultad, su evaluación
 *   resulta NO_DETERMINABLE (no existe un p03MaxMat aplicable a la suma cross-facultad).
 *   El indicador queda PARCIAL cuando hay docentes NO_DETERMINABLE.
 *   Decisión provisional del proyecto; pendiente de validación institucional.
 *
 * Limitaciones conocidas:
 *   DP-1: Cargo vigente — Cargo es un catálogo sin fechas de nombramiento; se aproxima
 *         por estado APROBADA de la vinculación.
 *   DP-4: Plan evaluado — FSD §3.3 exige asignaturas de planes evaluados. La equivalencia
 *         entre PlanEstudio.estado = 'ACTIVO' y "plan evaluado" no está confirmada; se omite
 *         el filtro hasta validación institucional.
 *
 * Estados:
 *   NO_APLICA:       sin vinculaciones APROBADAS en el alcance evaluado.
 *   NO_DETERMINABLE: sin config de facultad (p03MaxMat desconocido).
 *   PARCIAL:         evaluación con datos incompletos (alcanceFacultad=false o docentes cross-facultad).
 *   CALCULADO:       evaluación completa; todos los docentes evaluados definitivamente.
 *
 * Seguridad:
 *   - Rol verificado por IndicadoresService antes de llegar al evaluador.
 *   - Scope verificado por ConsultasAcademicasService en cada consulta.
 *   - Los datos cross-facultad solo se usan para clasificación (CALCULADO/NO_DETERMINABLE).
 *   - No se exponen identificadores, materias ni carreras de otras facultades.
 *   - No se expone información de docentes fuera del scope del usuario.
 */
// Advertencias estructurales sobre limitaciones del modelo de datos.
// Presentes en todos los estados con datos reales (CALCULADO, PARCIAL, NO_DETERMINABLE).
// No modifican estadoCalculo; informan a los consumidores sobre incertidumbre conocida.
const DP1_CARGO_VIGENTE: DatoFaltante = {
  campo: 'cargoVigente',
  entidad: 'Cargo',
  descripcion:
    'DP-1: La tabla Cargo es un catálogo de roles sin fechas de nombramiento individuales. ' +
    'La vigencia del cargo se aproxima por estado APROBADA de la vinculación; puede incluir ' +
    'cargos finalizados o excluir asignaciones pendientes de aprobación.',
};

const DP4_PLAN_EVALUADO: DatoFaltante = {
  campo: 'planEvaluado',
  entidad: 'PlanEstudio',
  descripcion:
    "DP-4: La equivalencia entre PlanEstudio.estado = 'ACTIVO' y plan evaluado (FSD §3.3) " +
    'no está confirmada institucionalmente. Se incluyen todas las vinculaciones APROBADAS ' +
    'sin filtrar por estado del plan hasta que se valide este criterio.',
};

@Injectable()
export class R07EvaluadorService implements IndicadorEvaluador<ResultadoR07> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR07>> {
    if (!contexto.carreraId) {
      throw new BadRequestException(
        'R-07 requiere carreraId. Proporcione el identificador de la carrera a evaluar.',
      );
    }

    const [vinsData, config] = await Promise.all([
      this.consultas.obtenerVinculacionesParaR07(
        contexto.carreraId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
      this.consultas.obtenerConfigDeCarrera(
        contexto.carreraId,
        contexto.usuarioId,
        contexto.rolNombre,
      ),
    ]);

    const { vinculaciones, facultadId, alcanceFacultad, docentesMultiFacultad } = vinsData;

    // Solo docentes activos con vinculaciones APROBADAS entran en el cálculo.
    // Docente.activo=false: ficha inactiva; se excluye independientemente del estado de la vinculación.
    const aprobadas = vinculaciones.filter((v) => v.estado === 'APROBADA' && v.docente.activo);

    if (aprobadas.length === 0) {
      return {
        codigo: 'R-07',
        contextoId: contexto.carreraId,
        tipoContexto: 'DOCENTE',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          carreraId: contexto.carreraId,
          facultadId,
          limite: config?.p03MaxMat ?? null,
          totalDocentes: 0,
          totalSobreasignados: 0,
          sobreasignados: [],
          totalNoDeterminables: 0,
          noDeterminables: [],
          alcanceFacultad,
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    if (config === null) {
      const totalDocentes = new Set(aprobadas.map((v) => v.docenteId)).size;
      return {
        codigo: 'R-07',
        contextoId: contexto.carreraId,
        tipoContexto: 'DOCENTE',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
        valor: {
          carreraId: contexto.carreraId,
          facultadId,
          limite: null,
          totalDocentes,
          totalSobreasignados: 0,
          sobreasignados: [],
          totalNoDeterminables: 0,
          noDeterminables: [],
          alcanceFacultad,
        },
        datosFaltantes: [
          {
            campo: 'p03MaxMat',
            entidad: 'AutoevaluacionConfigFacultad',
            descripcion:
              'No existe configuración MOD-AUT para la facultad de esta carrera. ' +
              'El límite máximo de materias (p03MaxMat) es necesario para evaluar R-07.',
          },
          DP1_CARGO_VIGENTE,
          DP4_PLAN_EVALUADO,
        ],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    // Acumular combinaciones distintas (planEstudioId, materiaId, catedraId) por docente.
    // FSD §3.3: "cantidad de combinaciones distintas (plan, asignatura, cátedra)".
    // Misma materia en dos cátedras → dos claves distintas → cuenta dos veces.
    // Dos cargos sobre la misma combinación → misma clave → cuenta una vez.
    // La clave mapea al nombre de la materia para permitir ordenamiento alfabético (FSD §5.3).
    const porDocente = new Map<string, { nombre: string; claves: Map<string, string> }>();
    for (const v of aprobadas) {
      const entry = porDocente.get(v.docenteId) ?? {
        nombre: `${v.docente.nombre} ${v.docente.apellido}`.trim(),
        claves: new Map<string, string>(),
      };
      const key = `${v.planEstudioId}|${v.materiaId}|${v.catedraId}`;
      if (!entry.claves.has(key)) {
        entry.claves.set(key, v.materiaNombre ?? '');
      }
      porDocente.set(v.docenteId, entry);
    }

    const limite = config.p03MaxMat;
    const sobreasignados: DocenteAlertaR07[] = [];
    const noDeterminables: DocenteNoDeterminableR07[] = [];

    for (const [docenteId, { nombre, claves }] of porDocente) {
      const nMaterias = claves.size;

      if (alcanceFacultad && docentesMultiFacultad.has(docenteId)) {
        // Docente con asignaciones cross-facultad: no se puede aplicar un único p03MaxMat.
        // Decisión 2B.3.6.1-B: quedar como NO_DETERMINABLE con causa explícita.
        noDeterminables.push({ docenteId, nombre, nMateriasConocidas: nMaterias, causa: 'CROSS_FACULTAD' });
        continue;
      }

      if (nMaterias > limite) {
        // Asignaciones ordenadas alfabéticamente por nombre de materia (FSD §5.3).
        // Empate de nombre → orden secundario por catedraId para determinismo.
        const asignaciones: AsignacionR07[] = [...claves.entries()]
          .map(([k, materiaNombre]) => {
            const [planEstudioId, materiaId, catedraId] = k.split('|');
            return { planEstudioId, materiaId, catedraId, materiaNombre };
          })
          .sort((a, b) => {
            const na = a.materiaNombre ?? '';
            const nb = b.materiaNombre ?? '';
            return na.localeCompare(nb, 'es') || a.catedraId.localeCompare(b.catedraId, 'es');
          });
        sobreasignados.push({ docenteId, nombre, nMaterias, exceso: nMaterias - limite, asignaciones });
      }
    }

    sobreasignados.sort((a, b) => b.exceso - a.exceso || a.nombre.localeCompare(b.nombre));

    const datosFaltantes: DatoFaltante[] = [];
    if (!alcanceFacultad) {
      datosFaltantes.push({
        campo: 'vinculacionesOtrasCarreras',
        entidad: 'VinculacionCatedra',
        descripcion:
          'La evaluación cubre únicamente la carrera solicitada. El rol DIRECTOR_CARRERA no ' +
          'permite acceder al resto de la facultad; los valores de nMaterias pueden estar subestimados.',
      });
    } else if (noDeterminables.length > 0) {
      datosFaltantes.push({
        campo: 'vinculacionesOtrasFacultades',
        entidad: 'VinculacionCatedra',
        descripcion:
          `${noDeterminables.length} docente(s) tienen asignaciones APROBADAS en más de una facultad. ` +
          'No es posible aplicar p03MaxMat de forma unívoca; su evaluación queda NO_DETERMINABLE.',
      });
    }
    datosFaltantes.push(DP1_CARGO_VIGENTE, DP4_PLAN_EVALUADO);

    const estadoCalculo = (!alcanceFacultad || noDeterminables.length > 0)
      ? EstadoCalculo.PARCIAL
      : EstadoCalculo.CALCULADO;

    return {
      codigo: 'R-07',
      contextoId: contexto.carreraId,
      tipoContexto: 'DOCENTE',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        carreraId: contexto.carreraId,
        facultadId,
        limite,
        totalDocentes: porDocente.size,
        totalSobreasignados: sobreasignados.length,
        sobreasignados,
        totalNoDeterminables: noDeterminables.length,
        noDeterminables,
        alcanceFacultad,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
