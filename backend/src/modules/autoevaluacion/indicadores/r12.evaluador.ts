import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type {
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';

// ── Tipos de resultado ────────────────────────────────────────────────────────

/**
 * Ítems de ficha evaluados por R-12.
 * 'docencia' no se incluye: el prototipo MOD-AUT v5.1 line 372 lo delega a R-04.
 * Todos los docentes en el universo de R-12 tienen al menos una APROBADA,
 * por lo que el ítem siempre pasaría y no aporta información útil aquí.
 */
export type ItemFichaR12 = 'personales' | 'formacionGrado' | 'areaDesempeno';

export interface DocenteAlertaR12 {
  docenteId: string;
  nombre: string;
  faltantes: ItemFichaR12[];
}

export interface DocenteNoDeterminableR12 {
  docenteId: string;
  nombre: string;
  causa: 'CROSS_FACULTAD';
}

/**
 * Valor del indicador R-12 para una carrera / facultad.
 *
 * - incompletos: docentes con al menos un ítem de ficha faltante.
 * - noDeterminables: docentes con asignaciones cross-facultad;
 *     la evaluación de su ficha no puede imputarse a una sola facultad.
 * - alcanceFacultad: false cuando el rol es DIRECTOR_CARRERA → PARCIAL.
 */
export interface ResultadoR12 {
  carreraId: string;
  facultadId: string;
  totalDocentes: number;
  totalIncompletos: number;
  incompletos: DocenteAlertaR12[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR12[];
  alcanceFacultad: boolean;
}

// ── Datos faltantes estructurales ─────────────────────────────────────────────

/**
 * R12-DP-01: El ítem "datos personales" se evalúa sobre fechaNacimiento y sexo.
 * Estos son los campos de datos personales nullable en el modelo Docente que tienen
 * equivalencia directa con los requerimientos de ficha CONEAU.
 * La especificación exacta (FSD §3.1 Tabla 2) no está disponible para confirmar
 * si se deben incluir otros campos (CUIT, localidad, provincia).
 * El resultado puede subestimar docentes con ficha incompleta si la especificación
 * institucional exige más campos que los aquí evaluados.
 */
const DP1_PERSONALES: DatoFaltante = {
  campo: 'personales',
  entidad: 'Docente',
  descripcion:
    'R12-DP-01: El ítem "datos personales" se evalúa sobre fechaNacimiento y sexo. ' +
    'La especificación exacta de los campos obligatorios (FSD §3.1 Tabla 2) no está ' +
    'confirmada institucionalmente. El resultado puede subestimar docentes con ficha incompleta.',
};

/**
 * R12-DP-02: El ítem "docencia" (cargo vigente con vinculación aprobada) corresponde
 * a R-04 según el diseño del prototipo MOD-AUT v5.1. R-04 está diferido (D-17).
 * Todos los docentes en el universo de R-12 tienen al menos una APROBADA,
 * por lo que la ausencia de ese ítem no puede detectarse desde R-12.
 */
const DP2_DOCENCIA_DIFERIDA: DatoFaltante = {
  campo: 'docencia',
  entidad: 'VinculacionCatedra',
  descripcion:
    'R12-DP-02: El ítem "cargo vigente con vinculación aprobada" es responsabilidad de R-04 ' +
    '(prototipo v5.1, línea 372). R-04 está diferido (D-17). Docentes sin ninguna vinculación ' +
    'APROBADA no son detectados por R-12.',
};

/** DP-1 compartido con R-07: cargo vigente aproximado por estado APROBADA. */
const DP_CARGO_VIGENTE: DatoFaltante = {
  campo: 'cargoVigente',
  entidad: 'Cargo',
  descripcion:
    'DP-1: La tabla Cargo es un catálogo de roles sin fechas de nombramiento individuales. ' +
    'La vigencia del cargo se aproxima por estado APROBADA de la vinculación; puede incluir ' +
    'cargos finalizados o excluir asignaciones pendientes de aprobación.',
};

// ── Evaluador ─────────────────────────────────────────────────────────────────

/**
 * Evaluador de R-12: Campos obligatorios faltantes en la ficha docente.
 *
 * Definición funcional (prototipo MOD-AUT v5.1, FICHA §3.1):
 *   Un docente tiene ficha incompleta si le falta alguno de los ítems evaluados:
 *     personales    → fechaNacimiento y sexo presentes (R12-DP-01)
 *     formacionGrado → tituloGrado no nulo y no vacío
 *     areaDesempeno  → areaDisciplinarId no nulo
 *   El ítem 'docencia' se delega a R-04 (R12-DP-02).
 *
 * Universo: docentes activos con al menos una VinculacionCatedra APROBADA en el alcance.
 * Alcance: facultad completa o carrera solicitada según el rol.
 *
 * Estados:
 *   NO_APLICA:  sin vinculaciones APROBADAS activas en el alcance.
 *   PARCIAL:    alcanceFacultad=false (DIRECTOR_CARRERA) o docentes cross-facultad presentes.
 *   CALCULADO:  evaluación completa, sin docentes cross-facultad.
 */
@Injectable()
export class R12EvaluadorService implements IndicadorEvaluador<ResultadoR12> {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  async evaluar(contexto: ContextoEvaluacion): Promise<ResultadoIndicador<ResultadoR12>> {
    if (!contexto.carreraId) {
      throw new BadRequestException(
        'R-12 requiere carreraId. Proporcione el identificador de la carrera a evaluar.',
      );
    }

    const { docentes, facultadId, alcanceFacultad, docentesMultiFacultad } =
      await this.consultas.obtenerDocentesParaR12(
        contexto.carreraId,
        contexto.usuarioId,
        contexto.rolNombre,
      );

    if (docentes.length === 0) {
      return {
        codigo: 'R-12',
        contextoId: contexto.carreraId,
        tipoContexto: 'DOCENTE',
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.NO_APLICA,
        valor: {
          carreraId: contexto.carreraId,
          facultadId,
          totalDocentes: 0,
          totalIncompletos: 0,
          incompletos: [],
          totalNoDeterminables: 0,
          noDeterminables: [],
          alcanceFacultad,
        },
        datosFaltantes: [],
        fechaEvaluacion: contexto.fechaEvaluacion,
      };
    }

    const incompletos: DocenteAlertaR12[] = [];
    const noDeterminables: DocenteNoDeterminableR12[] = [];

    for (const d of docentes) {
      const nombre = `${d.nombre} ${d.apellido}`.trim();

      if (alcanceFacultad && docentesMultiFacultad.has(d.docenteId)) {
        noDeterminables.push({ docenteId: d.docenteId, nombre, causa: 'CROSS_FACULTAD' });
        continue;
      }

      const faltantes: ItemFichaR12[] = [];

      // personales: fechaNacimiento y sexo presentes (R12-DP-01)
      if (!d.fechaNacimiento || !d.sexo || d.sexo.trim() === '') {
        faltantes.push('personales');
      }

      // formacionGrado: tituloGrado presente y no vacío
      if (!d.tituloGrado || d.tituloGrado.trim() === '') {
        faltantes.push('formacionGrado');
      }

      // areaDesempeno: areaDisciplinarId asignado
      if (!d.areaDisciplinarId) {
        faltantes.push('areaDesempeno');
      }

      if (faltantes.length > 0) {
        incompletos.push({ docenteId: d.docenteId, nombre, faltantes });
      }
    }

    incompletos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const datosFaltantes: DatoFaltante[] = [];
    if (!alcanceFacultad) {
      datosFaltantes.push({
        campo: 'vinculacionesOtrasCarreras',
        entidad: 'VinculacionCatedra',
        descripcion:
          'La evaluación cubre únicamente la carrera solicitada. El rol DIRECTOR_CARRERA no ' +
          'permite acceder al resto de la facultad; puede haber docentes activos en otras carreras ' +
          'de la misma facultad con ficha incompleta que no quedan incluidos.',
      });
    } else if (noDeterminables.length > 0) {
      datosFaltantes.push({
        campo: 'vinculacionesOtrasFacultades',
        entidad: 'VinculacionCatedra',
        descripcion:
          `${noDeterminables.length} docente(s) tienen asignaciones APROBADAS en más de una facultad. ` +
          'Su evaluación de completitud queda indeterminada en este contexto.',
      });
    }
    datosFaltantes.push(DP1_PERSONALES, DP2_DOCENCIA_DIFERIDA, DP_CARGO_VIGENTE);

    const estadoCalculo =
      !alcanceFacultad || noDeterminables.length > 0
        ? EstadoCalculo.PARCIAL
        : EstadoCalculo.CALCULADO;

    return {
      codigo: 'R-12',
      contextoId: contexto.carreraId,
      tipoContexto: 'DOCENTE',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo,
      valor: {
        carreraId: contexto.carreraId,
        facultadId,
        totalDocentes: docentes.length,
        totalIncompletos: incompletos.length,
        incompletos,
        totalNoDeterminables: noDeterminables.length,
        noDeterminables,
        alcanceFacultad,
      },
      datosFaltantes,
      fechaEvaluacion: contexto.fechaEvaluacion,
    };
  }
}
