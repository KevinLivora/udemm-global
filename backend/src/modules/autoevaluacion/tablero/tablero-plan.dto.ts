import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { DatoFaltante } from '../indicadores/indicadores.types';

/** FSD §8, Tabla 25, IPL-01 — Horas totales del plan vs P-10 (horasMinTotales). */
export interface ResultadoIPL01 {
  /** Suma de cargaHorariaTotal de las materias del plan. null si alguna sin horas. */
  horasTotal: number | null;
  /** P-10 configurado en PlanEstudio. null = umbral no configurado. */
  horasMinimas: number | null;
  /** horasTotal − horasMinimas. null si cualquiera es null. */
  diferencia: number | null;
  /** true = cumple, false = no cumple, null = sin umbral o no determinable. */
  cumple: boolean | null;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §8, Tabla 25, IPL-02 — Bloques que cumplen su umbral mínimo.
 * Denominador = bloques con umbral configurado.
 * Los bloques sin umbral no se cuentan ni como cumplidos ni como incumplidos.
 */
export interface ResultadoIPL02 {
  /** Bloques con umbral configurado cuyas horas >= mínimo. */
  bloquesCumplen: number;
  /** Cantidad de bloques con umbral configurado (denominador del «N de M»). */
  bloquesConUmbral: number;
  estadoCalculo: EstadoCalculo;
}

/**
 * FSD §8, Tabla 25, IPL-03 — Materias sin responsable de cátedra.
 * Derivado de R-08. Invariante: sinResponsable + inciertas + conResponsable = totalMaterias.
 */
export interface ResultadoIPL03 {
  /** Materias con alerta R-08 confirmada: sin APROBADA o todas APROBADAS con false. */
  sinResponsable: number;
  /** Materias con APROBADA pero esResponsableCatedra=null (ausencia no confirmada). */
  inciertas: number;
  /** Materias con al menos una APROBADA con esResponsableCatedra=true. */
  conResponsable: number;
  totalMaterias: number;
  estadoCalculo: EstadoCalculo;
}

/**
 * Evaluación de un bloque curricular para IPL-05.
 * CX en este backend corresponde al bloque CTC del FSD (P-14, horasMinCTX en Prisma).
 */
export interface EvaluacionBloqueIPL05 {
  /** Código del bloque. CX = CTC del FSD §4.2. TOTAL = suma del plan completo. */
  bloque: 'CB' | 'TB' | 'TA' | 'CX' | 'TOTAL';
  horasReales: number | null;
  /** null = umbral no configurado para este bloque. */
  horasMinimas: number | null;
  diferencia: number | null;
  /** true/false/null. null = sin umbral o no determinable. */
  cumple: boolean | null;
  estadoCalculo: EstadoCalculo;
}

/** FSD §8, Tabla 25, IPL-05 — Horas por tipo de bloque curricular. Derivado de R-09. */
export interface ResultadoIPL05 {
  /** Bloques CB, TB, TA, CX y TOTAL (en ese orden). */
  bloques: EvaluacionBloqueIPL05[];
  estadoCalculo: EstadoCalculo;
}

/**
 * Respuesta del endpoint POST /autoevaluacion/tablero/plan/:planEstudioId.
 *
 * estadoGeneralCalculo refleja el estado más restrictivo de los cuatro indicadores.
 * Orden de restricción: NO_DETERMINABLE > PARCIAL > NO_APLICA > CALCULADO.
 * CALCULADO no implica cumplimiento académico; NO_DETERMINABLE no es un semáforo rojo.
 */
export interface TablroPlanResponseDto {
  planEstudioId: string;
  /** ISO 8601 */
  fechaEvaluacion: string;
  ipl01: ResultadoIPL01;
  ipl02: ResultadoIPL02;
  ipl03: ResultadoIPL03;
  ipl05: ResultadoIPL05;
  estadoGeneralCalculo: EstadoCalculo;
  datosFaltantes: DatoFaltante[];
  advertencias: string[];
}
