import { Injectable } from '@nestjs/common';
import type {
  AlcanceIndicador,
  EstadoImplementacion,
  IndicadorEvaluador,
  SeveridadIndicador,
  TipoIndicador,
} from './indicadores.types';

export interface DefinicionIndicador {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: TipoIndicador;
  severidad: SeveridadIndicador;
  alcance: AlcanceIndicador;
  estadoImplementacion: EstadoImplementacion;
  /** Razón por la que la implementación está pendiente. Solo presente cuando NO_IMPLEMENTADO. */
  motivoPendiente?: string;
  evaluador?: IndicadorEvaluador<unknown>;
}

/**
 * Registro explícito de indicadores MOD-AUT.
 *
 * Diseño:
 * - Cada indicador se registra con sus metadatos funcionales.
 * - Los evaluadores se asignan en fases posteriores sin modificar la estructura.
 * - Los códigos deben ser únicos; el registro rechaza duplicados en tiempo de construcción.
 *
 * Fuente: prototipo Modulo_Autoevaluacion_v5_1.html + FSD_MODAUT_v1_1.docx.
 * R-01 y R-05 fueron eliminados en MOD-DOC v8.1 (dedicación y categoría no declaradas).
 */
@Injectable()
export class RegistroIndicadores {
  private readonly _mapa = new Map<string, DefinicionIndicador>();

  constructor() {
    this.registrarTodos();
  }

  private registrar(def: DefinicionIndicador): void {
    if (this._mapa.has(def.codigo)) {
      throw new Error(`Código duplicado en RegistroIndicadores: ${def.codigo}`);
    }
    this._mapa.set(def.codigo, { ...def });
  }

  obtener(codigo: string): DefinicionIndicador | undefined {
    return this._mapa.get(codigo);
  }

  listar(): DefinicionIndicador[] {
    return Array.from(this._mapa.values());
  }

  tieneEvaluador(codigo: string): boolean {
    return this._mapa.get(codigo)?.evaluador !== undefined;
  }

  /**
   * Asigna un evaluador concreto a un indicador registrado.
   * Permite incorporar nuevas implementaciones en fases posteriores sin modificar
   * esta estructura. Al asignar, el estado pasa a IMPLEMENTADO.
   */
  asignarEvaluador(codigo: string, evaluador: IndicadorEvaluador<unknown>): void {
    const def = this._mapa.get(codigo);
    if (!def) throw new Error(`No existe el indicador ${codigo} en el registro`);
    def.evaluador = evaluador;
    def.estadoImplementacion = 'IMPLEMENTADO';
    def.motivoPendiente = undefined;
  }

  private registrarTodos(): void {
    // ── Cruzadas DOC ↔ PDE ────────────────────────────────────────────────────

    this.registrar({
      codigo: 'R-02',
      nombre: 'Doble responsable de cátedra',
      descripcion:
        'Una asignatura no puede tener dos responsables de cátedra activos al mismo tiempo. ' +
        'La unidad de evaluación es (materiaId, catedraId): dos responsables en cátedras ' +
        'diferentes no constituyen incumplimiento (prototipo v5.1, línea 387-390).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'PLAN',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente: 'Pendiente de implementación en Fase 2B.3.2.',
    });

    this.registrar({
      codigo: 'R-04',
      nombre: 'Cargo sin actividad curricular',
      descripcion:
        'Cargo docente vigente sin ninguna asignación a cátedra.',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'DOCENTE',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente:
        'D-17: pospuesto hasta disponer de información laboral confiable sobre cargos docentes.',
    });

    this.registrar({
      codigo: 'R-08',
      nombre: 'Materias sin responsable de cátedra',
      descripcion:
        'Listado de materias del plan que no tienen ningún responsable de cátedra vigente (APROBADA + esResponsableCatedra=true).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'PLAN',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente: 'Pendiente de implementación en Fase 2B.3.2.',
    });

    // ── Docentes ──────────────────────────────────────────────────────────────

    this.registrar({
      codigo: 'R-03',
      nombre: 'Tope semanal de horas docentes',
      descripcion:
        'Docencia + gestión + desempeño no académico superan el tope semanal configurado (p01TopeH, ref. CONEAU Global).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'DOCENTE',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente:
        'R-03: tiempoGestionAcademica y dedicacionDeclaradaSemanal son String? — no existe campo numérico para desempeño no académico (R-03b). Riesgo de duplicación de horas (R-03d).',
    });

    this.registrar({
      codigo: 'R-06',
      nombre: 'Distribución de materias por docente',
      descripcion:
        'Materias por docente del plantel: promedio, mediana y máximo.',
      tipo: 'INDICADOR',
      severidad: 'NINGUNA',
      alcance: 'CARRERA',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente: 'Pendiente de implementación en Fase 2B.3.2.',
    });

    this.registrar({
      codigo: 'R-07',
      nombre: 'Docentes sobre-asignados',
      descripcion:
        'Listado de docentes con más materias vigentes que el máximo permitido (p03MaxMat).',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'DOCENTE',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente: 'Pendiente de implementación en Fase 2B.3.2.',
    });

    this.registrar({
      codigo: 'R-10',
      nombre: 'Docentes con baja dedicación',
      descripcion:
        'Docentes cuya dedicación total calculada es menor al umbral de baja carga (p02BajaH).',
      tipo: 'DETALLE',
      severidad: 'INFORMATIVA',
      alcance: 'DOCENTE',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente:
        'R-10: prohibido inferir equivalencias entre dedicación textual y horas numéricas sin definición institucional aprobada.',
    });

    this.registrar({
      codigo: 'R-12',
      nombre: 'Ficha docente incompleta',
      descripcion:
        'Campos obligatorios faltantes en la ficha docente: datos personales, título de grado, área de desempeño o cargo vigente con vinculación.',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'DOCENTE',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente: 'Pendiente de implementación en Fase 2B.3.2.',
    });

    // ── Planes de estudio ─────────────────────────────────────────────────────

    this.registrar({
      codigo: 'R-09',
      nombre: 'Umbrales horarios del plan de estudios',
      descripcion:
        'El plan debe superar las horas mínimas totales (horasMinTotales) y las de cada bloque curricular (CB, TB, TA, CX → horasMinCTX).',
      tipo: 'ALERTA',
      severidad: 'ALTA',
      alcance: 'PLAN',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente: 'Pendiente de implementación en Fase 2B.3.2.',
    });

    this.registrar({
      codigo: 'R-11',
      nombre: 'Inconsistencias en programas de asignatura',
      descripcion:
        'Campos incompletos o ítems repetidos en programas de asignatura del plan.',
      tipo: 'ALERTA',
      severidad: 'MEDIA',
      alcance: 'PLAN',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      motivoPendiente:
        'D-12: calcAvancePrograma pendiente de definición definitiva del cálculo ponderado.',
    });
  }
}
