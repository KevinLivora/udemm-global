import type { EstadoCalculo } from '../types/estado-calculo.types';

// ── IP-04 ─────────────────────────────────────────────────────────────────────

export interface DocenteDistribucionIP04 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

/**
 * FSD §7, IP-04 — Materias por docente.
 *
 * Unidad de conteo: distinct materiaId por docenteId con estado APROBADA y docente.activo=true.
 * Valor principal: mediana. Complementarios: promedio y máximo.
 * Null cuando totalDocentes = 0 (estadoCalculo → NO_APLICA).
 */
export interface ResultadoIP04 {
  totalDocentes: number;
  mediana: number | null;
  promedio: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionIP04[];
  estadoCalculo: EstadoCalculo;
}

// ── IP-13 ─────────────────────────────────────────────────────────────────────

export interface DocenteAlertaIP13 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
}

/**
 * FSD MOD-AUT §3.3 y §5.3, IP-13 — Docentes sobreasignados.
 *
 * Universo: docentes activos con vinculaciones APROBADAS en la facultad completa
 * (alcanceFacultad=true) o solo en la carrera solicitada (alcanceFacultad=false,
 * DIRECTOR_CARRERA → estadoCalculo PARCIAL).
 * Condición de alerta: nMaterias > limite (comparación estricta, FSD §5.3).
 * Unidad de conteo: combinaciones distintas (planEstudioId, materiaId, catedraId).
 * limite null indica que P-03 no está configurado (estadoCalculo → NO_DETERMINABLE).
 */
export interface ResultadoIP13 {
  /** Valor de P-03 (p03MaxMat) utilizado; null cuando la config no existe. */
  limite: number | null;
  totalDocentes: number;
  totalSobreasignados: number;
  sobreasignados: DocenteAlertaIP13[];
  /** Docentes con asignaciones cross-facultad cuya evaluación no pudo determinarse. */
  totalNoDeterminables: number;
  /** true cuando la evaluación cubrió toda la facultad; false (DIRECTOR_CARRERA) → PARCIAL. */
  alcanceFacultad: boolean;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-01 — Cantidad de docentes vigentes.
 * Distintos docenteId con ≥1 VinculacionCatedra estado='APROBADA' y docente.activo=true.
 */
export interface ResultadoIP01 {
  /** Docentes activos con al menos una asignación APROBADA en la carrera. */
  total: number;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §7, IP-02 — Cantidad de cargos docentes vigentes.
 * Pares (docenteId, cargoId) distintos, estado='APROBADA', docente.activo=true.
 * No incluye cargos de gestión («Otros»); solo categorías P y A (FSD exclusión explícita).
 */
export interface ResultadoIP02 {
  /** Cargos docentes (P+A) con docente activo y asignación APROBADA. */
  total: number;
  estadoCalculo: EstadoCalculo;
}

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
 * estadoGeneralCalculo refleja el estado más restrictivo entre IP-01, IP-02,
 * IP-03, IP-04, IP-08 e IP-13.
 */
export interface TablroCarreraResponseDto {
  carreraId: string;
  /** ISO 8601 */
  fechaEvaluacion: string;
  ip01: ResultadoIP01;
  ip02: ResultadoIP02;
  ip03: ResultadoIP03;
  ip04: ResultadoIP04;
  ip08: ResultadoIP08;
  ip13: ResultadoIP13;
  estadoGeneralCalculo: EstadoCalculo;
}
