import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface DocenteDistribucionR06 {
  docenteId: string;
  /** Nombre completo: docente.nombre + ' ' + docente.apellido */
  nombre: string;
  nMaterias: number;
}

/**
 * Valor del indicador R-06 para una carrera.
 *
 * Unidad de conteo: materias DISTINTAS (distinct materiaId) por docenteId.
 * Una materia en múltiples cátedras para el mismo docente cuenta como 1 materia.
 *
 * - totalDocentes: docentes con ≥1 vinculación APROBADA en la carrera.
 * - promedio / mediana / maximo: null si totalDocentes = 0 (estadoCalculo NO_APLICA).
 * - distribucion: ordenada por nMaterias DESC, luego nombre ASC.
 */
export interface ResultadoR06 {
  carreraId: string;
  totalDocentes: number;
  promedio: number | null;
  mediana: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionR06[];
}

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-06: Distribución de materias por docente.
 *
 * Definición funcional (prototipo MOD-AUT v5.1 líneas 349, 319-324, 603, 622):
 *   "Materias por docente: promedio, mediana y máximo."
 *
 * Vinculaciones efectivas:
 *   estado = 'APROBADA'. PENDIENTE/RECHAZADA/DESVINCULADA no se computan.
 *
 * Universo de docentes:
 *   Docentes con ≥1 vinculación APROBADA en la carrera. No existe relación directa
 *   Docente→Carrera en el modelo; el plantel se deriva de VinculacionCatedra.carreraId.
 *
 * Unidad de conteo:
 *   Distinct materiaId por docenteId. Una misma materia en distintas cátedras = 1 materia.
 *   Alcance: carrera completa (todos sus planes, agregación cross-plan via carreraId).
 *
 * Estado de cálculo:
 *   NO_APLICA:  carrera sin docentes con vinculaciones APROBADAS.
 *   CALCULADO:  ≥1 docente con vinculaciones APROBADAS (todos los materiaId son conocidos).
 *
 * Parámetro obligatorio:
 *   carreraId en ContextoEvaluacion. Si falta, se lanza BadRequestException.
 */
@Injectable()
export class R06EvaluadorService implements IndicadorEvaluador<ResultadoR06> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR06>> {
    if (!contexto.carreraId) {
      throw new BadRequestException(
        'R-06 requiere carreraId. Proporcione el identificador de la carrera a evaluar.',
      );
    }

    const vinculaciones = await this.consultas.obtenerVinculacionesDeCarrera(
      contexto.carreraId,
      contexto.usuarioId,
      contexto.rolNombre,
    );

    const aprobadas = vinculaciones.filter((v) => v.estado === 'APROBADA');

    if (aprobadas.length === 0) {
      return {
        codigo: 'R-06',
        contextoId: contexto.carreraId,
        tipoContexto: 'CARRERA',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          carreraId: contexto.carreraId,
          totalDocentes: 0,
          promedio: null,
          mediana: null,
          maximo: null,
          distribucion: [],
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    // Agregar materias distintas por docente (dedup por materiaId, no por cátedra)
    const porDocente = new Map<string, { nombre: string; materias: Set<string> }>();
    for (const v of aprobadas) {
      const entry = porDocente.get(v.docenteId) ?? {
        nombre: `${v.docente.nombre} ${v.docente.apellido}`.trim(),
        materias: new Set<string>(),
      };
      entry.materias.add(v.materiaId);
      porDocente.set(v.docenteId, entry);
    }

    const distribucion: DocenteDistribucionR06[] = [];
    const nMats: number[] = [];

    for (const [docenteId, { nombre, materias }] of porDocente) {
      distribucion.push({ docenteId, nombre, nMaterias: materias.size });
      nMats.push(materias.size);
    }

    distribucion.sort((a, b) => b.nMaterias - a.nMaterias || a.nombre.localeCompare(b.nombre));

    const sorted = [...nMats].sort((a, b) => a - b);
    const promedio = nMats.reduce((a, b) => a + b, 0) / nMats.length;
    const mediana = calcMedian(sorted);
    const maximo = sorted[sorted.length - 1];

    return {
      codigo: 'R-06',
      contextoId: contexto.carreraId,
      tipoContexto: 'CARRERA',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: {
        carreraId: contexto.carreraId,
        totalDocentes: distribucion.length,
        promedio,
        mediana,
        maximo,
        distribucion,
      },
      datosFaltantes: [],
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}

function calcMedian(sorted: number[]): number {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
