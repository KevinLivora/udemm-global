import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { MateriaAut, VinculacionAut } from '../consultas-academicas/consultas-academicas.types';
import { RegistroIndicadores } from './indicadores.registry';
import { R02EvaluadorService } from './r02.evaluador';
import type { ContextoEvaluacion } from './indicadores.types';

// ── Constantes ────────────────────────────────────────────────────────────────

const PLAN_ID = 'plan-01';
const CAR_ID  = 'car-01';
const MAT_A   = 'mat-a';
const MAT_B   = 'mat-b';
const CAT_1   = 'cat-1';
const CAT_2   = 'cat-2';
const FECHA   = new Date('2026-10-14');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: 'usr-01',
    rolNombre: 'ADMINISTRADOR_SISTEMA',
    planEstudioId: PLAN_ID,
    carreraId: CAR_ID,
    fechaEvaluacion: FECHA,
    ...overrides,
  };
}

function makeMateria(id: string, nombre = `Materia ${id}`, codigo = `COD-${id}`): MateriaAut {
  return {
    id, codigo, nombre,
    planEstudioId: PLAN_ID,
    estado: 'ACTIVO', anio: 1, cuatrimestre: 1,
    bloqueConocimientoRaw: 'CB', bloqueNormalizado: 'CB',
    cargaHorariaSemanal: 4, cargaHorariaTotal: 64,
    tipoAsignatura: 'OBLIGATORIA',
  };
}

let _vincCounter = 0;
function makeVinc(
  materiaId: string,
  catedraId: string,
  estado: string,
  esResponsableCatedra: boolean | null,
): VinculacionAut {
  _vincCounter++;
  return {
    id: `vin-${_vincCounter}`,
    materiaId,
    docenteId: `doc-${_vincCounter}`,
    catedraId,
    planEstudioId: PLAN_ID,
    carreraId: CAR_ID,
    estado,
    esResponsableCatedra,
    horasSemana: 4,
    docente: {
      id: `doc-${_vincCounter}`,
      nombre: 'Docente',
      apellido: `${_vincCounter}`,
      activo: true,
      dedicacion: null,
      categoriaDocente: null,
    },
  };
}

beforeEach(() => { _vincCounter = 0; });

function makeConsultas(materias: MateriaAut[], vinculaciones: VinculacionAut[]) {
  return {
    obtenerMateriasDePlan: jest.fn().mockResolvedValue(materias),
    obtenerVinculacionesDePlan: jest.fn().mockResolvedValue(vinculaciones),
  };
}

function makeEv(consultas: ReturnType<typeof makeConsultas>) {
  return new R02EvaluadorService(consultas as any);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. SIN planEstudioId — parámetro obligatorio
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — sin planEstudioId', () => {

  it('lanza BadRequestException cuando no hay planEstudioId', async () => {
    const ev = makeEv(makeConsultas([], []));
    await expect(ev.evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('mensaje menciona planEstudioId', async () => {
    const ev = makeEv(makeConsultas([], []));
    await expect(ev.evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(
      /planEstudioId/,
    );
  });

  it('no llama a ConsultasAcademicasService cuando falta planEstudioId', async () => {
    const c = makeConsultas([], []);
    await expect(makeEv(c).evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
    expect(c.obtenerMateriasDePlan).not.toHaveBeenCalled();
    expect(c.obtenerVinculacionesDePlan).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PLAN SIN MATERIAS
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — plan sin materias', () => {

  it('devuelve NO_APLICA con valor vacío', async () => {
    const ev = makeEv(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(res.valor!.totalMaterias).toBe(0);
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.valor!.paresInciertos).toHaveLength(0);
  });

  it('contextoId = planEstudioId, tipoContexto = PLAN', async () => {
    const ev = makeEv(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.contextoId).toBe(PLAN_ID);
    expect(res.tipoContexto).toBe('PLAN');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. RESPONSABLES — cantidad de true por par (materia, cátedra)
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — responsables por par (materia, cátedra)', () => {

  it('sin vinculaciones APROBADAS en la materia → sin alerta R-02', async () => {
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('un solo responsable APROBADO → sin alerta', async () => {
    const vincs = [makeVinc(MAT_A, CAT_1, 'APROBADA', true)];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('dos responsables APROBADOS misma cátedra → ALERTA confirmada', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(1);
    expect(res.valor!.paresConAlerta[0].cantidadResponsables).toBe(2);
    expect(res.valor!.paresConAlerta[0].catedraId).toBe(CAT_1);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('tres responsables APROBADOS misma cátedra → ALERTA con cantidadResponsables=3', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta[0].cantidadResponsables).toBe(3);
  });

  it('CASO B: dos responsables en cátedras diferentes de la misma materia → sin alerta', async () => {
    // Misma materia, cátedras distintas: un responsable por cátedra → no es R-02
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_2, 'APROBADA', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.valor!.paresInciertos).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. ESTADOS DE VINCULACIÓN NO EFECTIVOS
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — estados no efectivos', () => {

  it('PENDIENTE_DE_APROBACION con true + APROBADA con true → 1 efectivo → sin alerta', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'PENDIENTE_DE_APROBACION', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
  });

  it('RECHAZADA con true + APROBADA con true → 1 efectivo → sin alerta', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'RECHAZADA', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
  });

  it('DESVINCULADA con true + APROBADA con true → 1 efectivo → sin alerta', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'DESVINCULADA', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
  });

  it('dos APROBADAS true + dos PENDIENTES true → detecta 2 efectivos → ALERTA', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'PENDIENTE_DE_APROBACION', true),
      makeVinc(MAT_A, CAT_1, 'PENDIENTE_DE_APROBACION', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(1);
    expect(res.valor!.paresConAlerta[0].cantidadResponsables).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. CLASIFICACIÓN esResponsableCatedra — true / false / null
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — clasificación esResponsableCatedra', () => {

  it('APROBADA + false no contribuye al conteo de R-02', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', false),
      makeVinc(MAT_A, CAT_1, 'APROBADA', false),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.valor!.paresInciertos).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('APROBADA + null sola → no genera alerta ni incertidumbre (solo 1 total)', async () => {
    const vincs = [makeVinc(MAT_A, CAT_1, 'APROBADA', null)];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.valor!.paresInciertos).toHaveLength(0);
  });

  it('APROBADA true + APROBADA null misma cátedra → paresInciertos (1+1=2 → posible doble)', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', null),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.valor!.paresInciertos).toHaveLength(1);
    expect(res.valor!.paresInciertos[0].confirmedTrue).toBe(1);
    expect(res.valor!.paresInciertos[0].sinClasificar).toBe(1);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('APROBADA null + APROBADA null misma cátedra → paresInciertos (0+2=2 → posible doble)', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', null),
      makeVinc(MAT_A, CAT_1, 'APROBADA', null),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresInciertos).toHaveLength(1);
    expect(res.valor!.paresInciertos[0].confirmedTrue).toBe(0);
    expect(res.valor!.paresInciertos[0].sinClasificar).toBe(2);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('APROBADA true + APROBADA false → 1 true, 0 null → sin incertidumbre ni alerta', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', false),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.valor!.paresInciertos).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('null no se interpreta automáticamente como true ni como false', async () => {
    // Un null solo no genera alerta — no puede ser double por sí solo
    const vincs = [makeVinc(MAT_A, CAT_1, 'APROBADA', null)];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    // No hay alerta (null no es true)
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    // No hay incierto (1 null solo no alcanza el umbral de 2 posibles)
    expect(res.valor!.paresInciertos).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. MÚLTIPLES MATERIAS Y CÁTEDRAS — conteos y estados
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — múltiples materias y cátedras', () => {

  it('plan con alerta + sin incertidumbre → CALCULADO + paresConAlerta correcto', async () => {
    const materias = [makeMateria(MAT_A), makeMateria(MAT_B)];
    const vincs = [
      // MAT_A / CAT_1: doble confirmado
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      // MAT_B / CAT_1: solo uno → OK
      makeVinc(MAT_B, CAT_1, 'APROBADA', true),
    ];
    const ev = makeEv(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(1);
    expect(res.valor!.paresConAlerta[0].materiaId).toBe(MAT_A);
    expect(res.valor!.paresInciertos).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor!.totalMaterias).toBe(2);
  });

  it('plan con alerta + con incertidumbre → PARCIAL', async () => {
    const materias = [makeMateria(MAT_A), makeMateria(MAT_B)];
    const vincs = [
      // MAT_A / CAT_1: doble confirmado
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      // MAT_B / CAT_2: incierto
      makeVinc(MAT_B, CAT_2, 'APROBADA', null),
      makeVinc(MAT_B, CAT_2, 'APROBADA', null),
    ];
    const ev = makeEv(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta).toHaveLength(1);
    expect(res.valor!.paresInciertos).toHaveLength(1);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('sin ninguna alerta ni incertidumbre → CALCULADO + pares vacíos', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, CAT_1, 'APROBADA', true)];
    const ev = makeEv(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor!.paresConAlerta).toHaveLength(0);
    expect(res.valor!.paresInciertos).toHaveLength(0);
  });

  it('alerta incluye nombre y código de la materia', async () => {
    const materias = [makeMateria(MAT_A, 'Análisis Matemático', 'MAT-101')];
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
    ];
    const ev = makeEv(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.paresConAlerta[0].materiaNombre).toBe('Análisis Matemático');
    expect(res.valor!.paresConAlerta[0].materiaCodigo).toBe('MAT-101');
    expect(res.valor!.paresConAlerta[0].catedraId).toBe(CAT_1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. DATOS FALTANTES
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — datosFaltantes', () => {

  it('sin incertidumbre → datosFaltantes vacío', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
      makeVinc(MAT_A, CAT_1, 'APROBADA', true),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('con incertidumbre → datosFaltantes incluye campo esResponsableCatedra', async () => {
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', null),
      makeVinc(MAT_A, CAT_1, 'APROBADA', null),
    ];
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes).toHaveLength(1);
    expect(res.datosFaltantes[0].campo).toBe('esResponsableCatedra');
    expect(res.datosFaltantes[0].entidad).toBe('VinculacionCatedra');
  });

  it('datosFaltantes menciona la cantidad de pares inciertos', async () => {
    const materias = [makeMateria(MAT_A), makeMateria(MAT_B)];
    const vincs = [
      makeVinc(MAT_A, CAT_1, 'APROBADA', null), makeVinc(MAT_A, CAT_1, 'APROBADA', null),
      makeVinc(MAT_B, CAT_2, 'APROBADA', null), makeVinc(MAT_B, CAT_2, 'APROBADA', null),
    ];
    const ev = makeEv(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes[0].descripcion).toMatch(/2 par/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. CONSISTENCIA DEL CONTRATO
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — contrato ResultadoIndicador', () => {

  it('estadoImplementacion = IMPLEMENTADO siempre', async () => {
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], [makeVinc(MAT_A, CAT_1, 'APROBADA', true)]));
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('código = R-02', async () => {
    const ev = makeEv(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.codigo).toBe('R-02');
  });

  it('contextoId = planEstudioId', async () => {
    const ev = makeEv(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx({ planEstudioId: 'plan-xyz' }));
    expect(res.contextoId).toBe('plan-xyz');
  });

  it('tipoContexto = PLAN', async () => {
    const ev = makeEv(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.tipoContexto).toBe('PLAN');
  });

  it('fechaEvaluacion se preserva desde el contexto', async () => {
    const fecha = new Date('2025-06-01');
    const ev = makeEv(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx({ fechaEvaluacion: fecha }));
    expect(res.fechaEvaluacion).toBe(fecha);
  });

  it('estadoCalculo nunca es null cuando estadoImplementacion = IMPLEMENTADO', async () => {
    const ev = makeEv(makeConsultas([makeMateria(MAT_A)], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).not.toBeNull();
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. PROPAGACIÓN DE ERRORES
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — propagación de errores', () => {

  it('ForbiddenException de ConsultasAcademicasService se propaga', async () => {
    const c = {
      obtenerMateriasDePlan: jest.fn().mockRejectedValue(new ForbiddenException()),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    await expect(new R02EvaluadorService(c as any).evaluar(makeCtx())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('NotFoundException de ConsultasAcademicasService se propaga', async () => {
    const c = {
      obtenerMateriasDePlan: jest.fn().mockRejectedValue(new NotFoundException()),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    await expect(new R02EvaluadorService(c as any).evaluar(makeCtx())).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. INTEGRACIÓN CON RegistroIndicadores
// ════════════════════════════════════════════════════════════════════════════

describe('R02EvaluadorService — integración con RegistroIndicadores', () => {

  it('R-02 puede asignarse al registro y queda IMPLEMENTADO', () => {
    const registro = new RegistroIndicadores();
    const ev = new R02EvaluadorService(makeConsultas([], []) as any);
    registro.asignarEvaluador('R-02', ev);
    expect(registro.tieneEvaluador('R-02')).toBe(true);
    expect(registro.obtener('R-02')!.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('alcance de R-02 es PLAN (evaluación por plan, alertas a nivel materia)', () => {
    const registro = new RegistroIndicadores();
    expect(registro.obtener('R-02')!.alcance).toBe('PLAN');
  });
});
