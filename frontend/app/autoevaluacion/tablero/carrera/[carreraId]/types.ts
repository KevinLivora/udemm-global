export type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA';

/** FSD §7, IP-03 — Materias cubiertas en los planes de la carrera. */
export interface ResultadoIP03 {
  cubiertas: number;
  total: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-08 — Relación profesores / auxiliares del plantel de la carrera. */
export interface ResultadoIP08 {
  profesores: number;
  auxiliares: number;
  /** P / A redondeado a 1 decimal. null si auxiliares = 0. */
  ratio: number | null;
  estadoCalculo: EstadoCalculo;
}

export interface TablroCarreraResponse {
  carreraId: string;
  /** ISO 8601 */
  fechaEvaluacion: string;
  ip03: ResultadoIP03;
  ip08: ResultadoIP08;
  estadoGeneralCalculo: EstadoCalculo;
}
