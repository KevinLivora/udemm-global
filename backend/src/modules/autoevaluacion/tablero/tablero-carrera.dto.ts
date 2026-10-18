import type { EstadoCalculo } from '../types/estado-calculo.types';

/**
 * FSD §7, IP-03 — Materias cubiertas por el plantel de la carrera.
 *
 * «N de M asignaturas con al menos una asignación válida (estado APROBADA)
 * sobre el total de asignaturas en todos los planes de la carrera.»
 */
export interface ResultadoIP03 {
  /** Materias con al menos una VinculacionCatedra en estado APROBADA. */
  cubiertas: number;
  /** Total de materias en todos los planes de la carrera. */
  total: number;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-08 — Relación profesores / auxiliares del plantel de la carrera.
 *
 * P = cargos vigentes de categoría Titular, Asociado o Adjunto.
 * A = cargos vigentes de categoría JTP, Ayudante Graduado o Ayudante No Graduado.
 * «Otros» (gestión u otros tipos) no se cuenta.
 *
 * Unidad de conteo: pares (docenteId, cargoId) distintos con estado APROBADA.
 * Si A = 0 → ratio = null (mostrar «—» en la UI, según FSD).
 */
export interface ResultadoIP08 {
  profesores: number;
  auxiliares: number;
  /** profesores / auxiliares, redondeado a 1 decimal. null si auxiliares = 0. */
  ratio: number | null;
  estadoCalculo: EstadoCalculo;
}

/**
 * Respuesta del endpoint POST /autoevaluacion/tablero/carrera/:carreraId.
 *
 * estadoGeneralCalculo refleja el estado más restrictivo de IP-03 e IP-08.
 */
export interface TablroCarreraResponseDto {
  carreraId: string;
  /** ISO 8601 */
  fechaEvaluacion: string;
  ip03: ResultadoIP03;
  ip08: ResultadoIP08;
  estadoGeneralCalculo: EstadoCalculo;
}
