import type { EstadoCalculo } from '../types/estado-calculo.types';

// ── Clasificación ────────────────────────────────────────────────────────────

/** Nivel institucional al que corresponde la evaluación del indicador. */
export type AlcanceIndicador =
  | 'FACULTAD'
  | 'CARRERA'
  | 'PLAN'
  | 'MATERIA'
  | 'CATEDRA'
  | 'DOCENTE';

/** Clasificación funcional del indicador según el prototipo MOD-AUT v5.1. */
export type TipoIndicador = 'ALERTA' | 'INDICADOR' | 'DETALLE';

export type SeveridadIndicador = 'ALTA' | 'MEDIA' | 'INFORMATIVA' | 'NINGUNA';

/**
 * Estado de codificación del indicador.
 * Distingue entre "la regla existe pero no está codificada aún" (NO_IMPLEMENTADO)
 * y "la regla está codificada y puede calcularse" (IMPLEMENTADO).
 *
 * No confundir con EstadoCalculo, que describe la confiabilidad del resultado
 * cuando la regla YA está implementada.
 */
export type EstadoImplementacion = 'IMPLEMENTADO' | 'NO_IMPLEMENTADO';

// ── Contexto de evaluación ────────────────────────────────────────────────────

/**
 * Identifica quién solicita la evaluación y sobre qué entidad institucional.
 * El orquestador verifica que el usuario tenga scope sobre los IDs proporcionados.
 */
export interface ContextoEvaluacion {
  usuarioId: string;
  rolNombre: string;
  facultadId?: string;
  carreraId?: string;
  planEstudioId?: string;
  fechaEvaluacion: Date;
}

// ── Contrato de resultado ─────────────────────────────────────────────────────

export interface DatoFaltante {
  campo: string;
  entidad: string;
  descripcion: string;
}

/**
 * Contrato reutilizable para el resultado de cualquier indicador MOD-AUT.
 *
 * Invariante:
 *   estadoImplementacion = 'NO_IMPLEMENTADO' → estadoCalculo = null, valor = null
 *   estadoImplementacion = 'IMPLEMENTADO'    → estadoCalculo ∈ EstadoCalculo (nunca null)
 *
 * Tipos de valor posibles según indicador:
 *   number (horas, conteos, porcentajes), boolean (cumple/no cumple),
 *   string[] (listados de hallazgos), distribuciones, etc.
 */
export interface ResultadoIndicador<T = unknown> {
  codigo: string;
  /** ID de la entidad evaluada (carreraId, planEstudioId, materiaId, etc.) */
  contextoId: string;
  tipoContexto: AlcanceIndicador;
  estadoImplementacion: EstadoImplementacion;
  /**
   * null cuando estadoImplementacion = 'NO_IMPLEMENTADO' — no se ejecutó ninguna regla real.
   * EstadoCalculo cuando la regla está implementada (puede ser NO_DETERMINABLE si faltan datos).
   */
  estadoCalculo: EstadoCalculo | null;
  valor: T | null;
  unidad?: string;
  datosFaltantes: DatoFaltante[];
  evidencias?: string[];
  observaciones?: string;
  parametrosUsados?: Record<string, unknown>;
  fechaEvaluacion: Date;
}

// ── Interfaz de evaluador ─────────────────────────────────────────────────────

/**
 * Contrato que debe implementar cada evaluador concreto.
 * El evaluador recibe un contexto ya validado (rol + scope verificados por el orquestador).
 */
export interface IndicadorEvaluador<T = unknown> {
  evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<T>>;
}

// ── Constructores de resultados ───────────────────────────────────────────────

/**
 * Construye un resultado para una regla no implementada.
 * No devuelve datos académicos ni valores ficticios.
 */
export function resultadoNoImplementado(
  codigo: string,
  contextoId: string,
  tipoContexto: AlcanceIndicador,
  fechaEvaluacion: Date,
): ResultadoIndicador<never> {
  return {
    codigo,
    contextoId,
    tipoContexto,
    estadoImplementacion: 'NO_IMPLEMENTADO',
    estadoCalculo: null,
    valor: null,
    datosFaltantes: [],
    fechaEvaluacion,
  };
}
