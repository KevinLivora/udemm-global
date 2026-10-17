/**
 * Estado de calculabilidad de un indicador o regla de MOD-AUT.
 * Permite distinguir resultados confiables de aproximaciones y datos ausentes.
 */
export enum EstadoCalculo {
  /** Todas las fuentes disponibles y parseadas. Valor confiable. */
  CALCULADO = 'CALCULADO',
  /** Resultado obtenido con al menos una fuente incompleta o ausente. Puede subestimar. */
  PARCIAL = 'PARCIAL',
  /** No es posible calcular. Fuente crítica ausente o malformada. No mostrar como 0. */
  NO_DETERMINABLE = 'NO_DETERMINABLE',
  /** El indicador no aplica al contexto evaluado (e.g., R-09 sin umbral configurado). */
  NO_APLICA = 'NO_APLICA',
}

/** Contenedor tipado para un resultado calculado con su estado de confiabilidad. */
export interface ResultadoCalculo<T> {
  valor: T | null;
  estado: EstadoCalculo;
  /** Nombres de las fuentes que no pudieron leerse, si el estado es PARCIAL. */
  fuentesIncompletas?: string[];
}

/** Crea un resultado calculado con valor confiable. */
export function calculado<T>(valor: T): ResultadoCalculo<T> {
  return { valor, estado: EstadoCalculo.CALCULADO };
}

/** Crea un resultado calculado con información incompleta. */
export function parcial<T>(valor: T, fuentesIncompletas: string[]): ResultadoCalculo<T> {
  return { valor, estado: EstadoCalculo.PARCIAL, fuentesIncompletas };
}

/** Crea un resultado no determinable (no mostrar como 0). */
export function noDeterminable<T = null>(): ResultadoCalculo<T> {
  return { valor: null, estado: EstadoCalculo.NO_DETERMINABLE };
}

/** Crea un resultado no aplicable al contexto. */
export function noAplica<T = null>(): ResultadoCalculo<T> {
  return { valor: null, estado: EstadoCalculo.NO_APLICA };
}
