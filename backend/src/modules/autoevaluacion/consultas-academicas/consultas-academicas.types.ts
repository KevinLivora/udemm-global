/**
 * Tipos consolidados para la capa de recuperación de datos académicos de MOD-AUT.
 *
 * Convenciones:
 * - Los campos nullable conservan null (nunca se convierten en 0 o "").
 * - Los estados son strings literales que reflejan los valores reales de la BD.
 * - BloqueNormalizado es el mapeado interno de MOD-AUT; bloqueConocimientoRaw
 *   conserva el valor original para trazabilidad.
 */

// ── Bloques curriculares ──────────────────────────────────────────────────────

/**
 * Cuatro bloques que MOD-AUT reconoce como clasificados.
 * null = bloque ausente o con valor no reconocido en el sistema.
 *
 * Valor canonical → campo de umbral en PlanEstudio:
 *   CB  → horasMinCB
 *   TB  → horasMinTB
 *   TA  → horasMinTA
 *   CX  → horasMinCTX  (Ciencias y Tecnologías Complementarias)
 *
 * Se reconocen como equivalentes a CX: "CTX" (nombre del campo Prisma) y "CTC" (prototipo HTML v5.1).
 */
export type BloqueNormalizado = 'CB' | 'TB' | 'TA' | 'CX' | null;

// ── Estructura institucional ──────────────────────────────────────────────────

export interface FacultadAut {
  id: string;
  nombre: string;
  estado: string;
  codigo: string | null;
}

export interface CarreraAut {
  id: string;
  nombre: string;
  facultadId: string;
  estado: string;
  codigo: string | null;
}

export interface UmbralesAut {
  /** null = umbral no configurado; R-09 no evalúa ese bloque */
  horasMinTotales: number | null;
  horasMinCB: number | null;
  horasMinTB: number | null;
  horasMinTA: number | null;
  /** Umbral del bloque CX (Ciencias y Tecnologías Complementarias). El campo Prisma conserva el nombre horasMinCTX. */
  horasMinCTX: number | null;
}

export interface PlanEstudioAut {
  id: string;
  nombre: string;
  carreraId: string;
  version: string | null;
  anio: number | null;
  estado: string;
  fechaAprobacion: Date | null;
  umbrales: UmbralesAut;
}

// ── Materias ──────────────────────────────────────────────────────────────────

export interface MateriaAut {
  id: string;
  codigo: string;
  nombre: string;
  planEstudioId: string;
  estado: string;
  anio: number | null;
  cuatrimestre: number | null;
  /** Valor original del campo bloqueConocimiento tal como está en la BD */
  bloqueConocimientoRaw: string | null;
  /** Bloque normalizado a los cuatro reconocidos; null si ausente o desconocido */
  bloqueNormalizado: BloqueNormalizado;
  /** null preservado — nunca convertido a 0 */
  cargaHorariaSemanal: number | null;
  /** null preservado — nunca convertido a 0 */
  cargaHorariaTotal: number | null;
  tipoAsignatura: string;
}

// ── Docentes y vinculaciones ──────────────────────────────────────────────────

export interface DocenteAut {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  /** String libre o null — no se infiere ni normaliza en esta fase */
  dedicacion: string | null;
  categoriaDocente: string | null;
}

export interface VinculacionAut {
  id: string;
  materiaId: string;
  /**
   * Nombre de la materia; poblado solo por obtenerVinculacionesParaR07.
   * undefined en otros métodos de consulta.
   */
  materiaNombre?: string;
  docenteId: string;
  catedraId: string;
  planEstudioId: string;
  carreraId: string;
  /**
   * 'PENDIENTE_DE_APROBACION' | 'APROBADA' | 'RECHAZADA' | 'DESVINCULADA'
   * Todos los estados se preservan; el consumidor decide cómo filtrarlos.
   */
  estado: string;
  /**
   * true = responsable confirmado, false = confirmado como no responsable,
   * null = sin clasificar. Responsable efectivo = APROBADA + true.
   */
  esResponsableCatedra: boolean | null;
  /** null preservado — copia de materia.cargaHorariaSemanal al crear */
  horasSemana: number | null;
  docente: DocenteAut;
}

// ── Programas de asignatura ───────────────────────────────────────────────────

export type EstadoSeccion = 'PENDIENTE' | 'COMPLETO';

export interface SeccionesPrograma {
  s1: EstadoSeccion;
  s2: EstadoSeccion;
  s3: EstadoSeccion;
  s4: EstadoSeccion;
  s5: EstadoSeccion;
  s6: EstadoSeccion;
}

export interface ProgramaAut {
  id: string;
  materiaId: string;
  /** 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' */
  estadoPrograma: string;
  secciones: SeccionesPrograma;
  fechaAprobacion: Date | null;
  anioVigencia: number | null;
  /** Discriminante explícito: siempre true en este tipo */
  readonly tienePrograma: true;
}

// ── Configuraciones ───────────────────────────────────────────────────────────

export interface ConfigFacultadAut {
  facultadId: string;
  p01TopeH: number;
  p02BajaH: number;
  p03MaxMat: number;
  updatedAt: Date;
}

// ── R-07: consulta cross-carrera ──────────────────────────────────────────────

/**
 * Resultado de la consulta de vinculaciones para el evaluador R-07.
 * Incluye el alcance real de la consulta según el rol del usuario.
 *
 * alcanceFacultad = true:  vinculaciones de TODAS las carreras de la facultad.
 * alcanceFacultad = false: vinculaciones de la carrera solicitada únicamente.
 *   → R-07 debe devolver EstadoCalculo.PARCIAL cuando alcanceFacultad = false.
 *
 * docentesMultiFacultad: subconjunto de docenteIds del scope que también tienen
 *   vinculaciones APROBADAS en otras facultades. Vacío cuando alcanceFacultad = false
 *   (sin detección en scope parcial). Calculado internamente; no expone datos externos.
 */
export interface VinculacionesParaR07 {
  vinculaciones: VinculacionAut[];
  facultadId: string;
  alcanceFacultad: boolean;
  docentesMultiFacultad: Set<string>;
}

/**
 * LIMITACIONES R-03 — Recuperación de datos docentes (pendientes de resolución futura)
 *
 * R-03a: Horas de gestión almacenadas como String?
 *   El campo que registra horas de gestión docente usa tipo String en lugar de Int/Float.
 *   MOD-AUT no puede realizar sumas ni comparaciones numéricas directas sobre ese campo.
 *   Workaround al calcular: parsear con parseInt/parseFloat, propagando null si falla.
 *
 * R-03b: Ausencia de campo desempeñoNoAcademico
 *   No existe un campo que registre actividades fuera del aula (investigación, extensión).
 *   Los indicadores que requieren esa información no pueden calcularse con el modelo actual.
 *
 * R-03c: Ausencia de consulta centrada en el docente
 *   ConsultasAcademicasService recupera vinculaciones por plan, no por docente.
 *   Para calcular la carga total de un docente en toda la institución se deben agregar
 *   sus vinculaciones APROBADAS a través de múltiples planes/carreras.
 *
 * R-03d: Riesgo de duplicación de horas
 *   Si un docente tiene vinculaciones APROBADAS en múltiples planes que comparten cátedras,
 *   una suma directa de horasSemana puede contabilizar las mismas horas más de una vez.
 *   El consumidor de VinculacionAut debe deduplicar por (materiaId, catedraId) antes de sumar.
 */
