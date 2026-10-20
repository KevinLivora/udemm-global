export type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA';

/** FSD §7, IP-01 — Cantidad de docentes vigentes (docente.activo=true, asignación APROBADA). */
export interface ResultadoIP01 {
  total: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-02 — Cantidad de cargos docentes vigentes (P+A, docente.activo=true). No incluye gestión. */
export interface ResultadoIP02 {
  total: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-03 — Materias cubiertas en los planes de la carrera. */
export interface ResultadoIP03 {
  cubiertas: number;
  total: number;
  estadoCalculo: EstadoCalculo;
}

/** FSD §7, IP-04 — Materias por docente. Mediana como valor principal. */
export interface DocenteDistribucionIP04 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

export interface ResultadoIP04 {
  totalDocentes: number;
  mediana: number | null;
  promedio: number | null;
  maximo: number | null;
  distribucion: DocenteDistribucionIP04[];
  estadoCalculo: EstadoCalculo;
}

/** FSD MOD-AUT §3.3 y §5.3, IP-13 — Docentes sobreasignados. */
export interface DocenteAlertaIP13 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
}

export interface ResultadoIP13 {
  limite: number | null;
  totalDocentes: number;
  totalSobreasignados: number;
  sobreasignados: DocenteAlertaIP13[];
  totalNoDeterminables: number;
  alcanceFacultad: boolean;
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
  ip01: ResultadoIP01;
  ip02: ResultadoIP02;
  ip03: ResultadoIP03;
  ip04: ResultadoIP04;
  ip08: ResultadoIP08;
  ip13: ResultadoIP13;
  estadoGeneralCalculo: EstadoCalculo;
}
