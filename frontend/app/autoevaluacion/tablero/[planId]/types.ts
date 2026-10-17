export type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA';

export interface DatoFaltante {
  campo: string;
  descripcion?: string;
}

export interface ResultadoIPL01 {
  horasTotal: number | null;
  horasMinimas: number | null;
  diferencia: number | null;
  cumple: boolean | null;
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL02 {
  bloquesCumplen: number;
  bloquesConUmbral: number;
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL03 {
  sinResponsable: number;
  inciertas: number;
  conResponsable: number;
  totalMaterias: number;
  estadoCalculo: EstadoCalculo;
}

export interface EvaluacionBloqueIPL05 {
  bloque: 'CB' | 'TB' | 'TA' | 'CX' | 'TOTAL';
  horasReales: number | null;
  horasMinimas: number | null;
  diferencia: number | null;
  cumple: boolean | null;
  estadoCalculo: EstadoCalculo;
}

export interface ResultadoIPL05 {
  bloques: EvaluacionBloqueIPL05[];
  estadoCalculo: EstadoCalculo;
}

export interface TablroPlanResponse {
  planEstudioId: string;
  fechaEvaluacion: string;
  ipl01: ResultadoIPL01;
  ipl02: ResultadoIPL02;
  ipl03: ResultadoIPL03;
  ipl05: ResultadoIPL05;
  estadoGeneralCalculo: EstadoCalculo;
  datosFaltantes: DatoFaltante[];
  advertencias: string[];
}
