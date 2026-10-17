import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { MateriaAut } from '../consultas-academicas/consultas-academicas.types';
import { RegistroIndicadores } from './indicadores.registry';
import { R09EvaluadorService } from './r09.evaluador';
import type { ContextoEvaluacion } from './indicadores.types';

// ── Constantes ────────────────────────────────────────────────────────────────

const PLAN_ID = 'plan-01';
const CAR_ID  = 'car-01';
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

function makeUmbrales(overrides: {
  horasMinTotales?: number | null;
  horasMinCB?: number | null;
  horasMinTB?: number | null;
  horasMinTA?: number | null;
  horasMinCTX?: number | null;
} = {}) {
  return {
    planEstudioId: PLAN_ID,
    horasMinTotales: overrides.horasMinTotales ?? null,
    horasMinCB: overrides.horasMinCB ?? null,
    horasMinTB: overrides.horasMinTB ?? null,
    horasMinTA: overrides.horasMinTA ?? null,
    horasMinCTX: overrides.horasMinCTX ?? null,
  };
}

let _matCounter = 0;
beforeEach(() => { _matCounter = 0; });

function makeMateria(
  overrides: {
    id?: string;
    nombre?: string;
    codigo?: string;
    bloqueConocimiento?: string | null;
    cargaHorariaTotal?: number | null;
    cargaHorariaSemanal?: number | null;
    estado?: string;
    anio?: number;
  } = {},
): MateriaAut {
  _matCounter++;
  const bloque = overrides.bloqueConocimiento !== undefined
    ? overrides.bloqueConocimiento
    : 'CB';
  return {
    id: overrides.id ?? `mat-${_matCounter}`,
    codigo: overrides.codigo ?? `COD-${_matCounter}`,
    nombre: overrides.nombre ?? `Materia ${_matCounter}`,
    planEstudioId: PLAN_ID,
    estado: overrides.estado ?? 'ACTIVO',
    anio: overrides.anio ?? 1,
    cuatrimestre: 1,
    bloqueConocimientoRaw: bloque,
    bloqueNormalizado: normalizarBloqueTest(bloque),
    cargaHorariaSemanal: overrides.cargaHorariaSemanal ?? null,
    cargaHorariaTotal: overrides.cargaHorariaTotal !== undefined ? overrides.cargaHorariaTotal : 100,
    tipoAsignatura: 'OBLIGATORIA',
  };
}

// Replica normalizarBloque() para tests sin depender del servicio real
function normalizarBloqueTest(v: string | null | undefined): 'CB' | 'TB' | 'TA' | 'CX' | null {
  if (!v) return null;
  const u = v.trim().toUpperCase();
  if (u === 'CB') return 'CB';
  if (u === 'TB') return 'TB';
  if (u === 'TA') return 'TA';
  if (u === 'CTX' || u === 'CX' || u === 'CTC') return 'CX';
  return null;
}

function makeConsultas(materias: MateriaAut[]) {
  return { obtenerMateriasDePlan: jest.fn().mockResolvedValue(materias) };
}

function makeConfigPlan(umbrales = makeUmbrales()) {
  return { obtenerUmbrales: jest.fn().mockResolvedValue(umbrales) };
}

function makeEv(consultas: ReturnType<typeof makeConsultas>, configPlan: ReturnType<typeof makeConfigPlan>) {
  return new R09EvaluadorService(consultas as any, configPlan as any);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. SIN planEstudioId
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — sin planEstudioId', () => {

  it('lanza BadRequestException cuando no hay planEstudioId', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    await expect(ev.evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(BadRequestException);
  });

  it('mensaje menciona planEstudioId', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    await expect(ev.evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(/planEstudioId/);
  });

  it('no llama a ningún servicio cuando falta planEstudioId', async () => {
    const c = makeConsultas([]);
    const cp = makeConfigPlan();
    await expect(makeEv(c, cp).evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(BadRequestException);
    expect(c.obtenerMateriasDePlan).not.toHaveBeenCalled();
    expect(cp.obtenerUmbrales).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PLAN SIN MATERIAS
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — plan sin materias', () => {

  it('devuelve NO_APLICA', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('totalMaterias = 0, listas vacías', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.totalMaterias).toBe(0);
    expect(res.valor!.materiasSinHoras).toHaveLength(0);
    expect(res.valor!.materiasConBloqueIndeterminado).toHaveLength(0);
  });

  it('con umbral configurado: horasReales=null, horasMinimas=umbral, cumple=null', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan(makeUmbrales({ horasMinTotales: 3600 })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.total.horasReales).toBeNull();
    expect(res.valor!.evaluaciones.total.horasMinimas).toBe(3600);
    expect(res.valor!.evaluaciones.total.cumple).toBeNull();
  });

  it('contextoId = planEstudioId, tipoContexto = PLAN', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx({ planEstudioId: 'plan-xyz' }));
    expect(res.contextoId).toBe('plan-xyz');
    expect(res.tipoContexto).toBe('PLAN');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. HORAS TOTALES
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — cálculo de horas totales', () => {

  it('una materia con horas → horasTotal = esas horas', async () => {
    const ev = makeEv(makeConsultas([makeMateria({ cargaHorariaTotal: 200 })]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasTotal).toBe(200);
  });

  it('varias materias → horasTotal = suma', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 400, bloqueConocimiento: 'TB' }),
      makeMateria({ cargaHorariaTotal: 200, bloqueConocimiento: 'TA' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasTotal).toBe(900);
  });

  it('materia con cargaHorariaTotal = 0 → contribuye 0 al total', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 300 }),
      makeMateria({ cargaHorariaTotal: 0 }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasTotal).toBe(300);
  });

  it('una materia sin horas → horasTotal = null', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 300 }),
      makeMateria({ cargaHorariaTotal: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasTotal).toBeNull();
  });

  it('usa cargaHorariaTotal (no semanal) — cargaHorariaSemanal ignorada', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 500, cargaHorariaSemanal: 10 }),
      makeMateria({ cargaHorariaTotal: 300, cargaHorariaSemanal: 6 }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasTotal).toBe(800);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. HORAS POR BLOQUE — acumulación y normalización
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — horas por bloque', () => {

  it('CB acumula materias con bloqueConocimiento = CB', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 200, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 150, bloqueConocimiento: 'CB' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CB).toBe(350);
  });

  it('TB acumula materias con bloque TB', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'TB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.TB).toBe(300);
    expect(res.valor!.horasPorBloque.CB).toBe(0);
  });

  it('TA acumula materias con bloque TA', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 250, bloqueConocimiento: 'TA' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.TA).toBe(250);
  });

  it('CX acumula materias con bloque CX', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 180, bloqueConocimiento: 'CX' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CX).toBe(180);
  });

  it('CTX se normaliza a CX y acumula en el bloque CX', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 120, bloqueConocimiento: 'CTX' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CX).toBe(120);
  });

  it('CTC se normaliza a CX', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 90, bloqueConocimiento: 'CTC' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CX).toBe(90);
  });

  it('código desconocido → materia en conBloqueIndeterminado, no suma a ningún bloque', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: 'XY' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.materiasConBloqueIndeterminado).toHaveLength(1);
    expect(res.valor!.materiasConBloqueIndeterminado[0].bloqueConocimientoRaw).toBe('XY');
    // Las sumas de bloque son null (horas indeterminadas con horas > 0)
    expect(res.valor!.horasPorBloque.CB).toBeNull();
    expect(res.valor!.horasPorBloque.TB).toBeNull();
    expect(res.valor!.horasPorBloque.TA).toBeNull();
    expect(res.valor!.horasPorBloque.CX).toBeNull();
  });

  it('bloque null → materia en conBloqueIndeterminado, no suma a ningún bloque', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: null })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.materiasConBloqueIndeterminado).toHaveLength(1);
    expect(res.valor!.materiasConBloqueIndeterminado[0].bloqueConocimientoRaw).toBeNull();
  });

  it('bloque con espacios/minúsculas se normaliza correctamente', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: '  cb  ' }),
      makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: 'tb' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CB).toBe(100);
    expect(res.valor!.horasPorBloque.TB).toBe(100);
  });

  it('materia con bloque null y cargaHorariaTotal = 0 no genera incertidumbre en bloques', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 0, bloqueConocimiento: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    // La materia con 0 horas y bloque null no hace inciertos los bloques
    expect(res.valor!.horasPorBloque.CB).toBe(300);
    expect(res.valor!.horasPorBloque.TB).toBe(0);
    expect(res.valor!.horasPorBloque.TA).toBe(0);
    expect(res.valor!.horasPorBloque.CX).toBe(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('materias de todos los bloques acumulan correctamente', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 200, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'TB' }),
      makeMateria({ cargaHorariaTotal: 250, bloqueConocimiento: 'TA' }),
      makeMateria({ cargaHorariaTotal: 150, bloqueConocimiento: 'CTX' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CB).toBe(200);
    expect(res.valor!.horasPorBloque.TB).toBe(300);
    expect(res.valor!.horasPorBloque.TA).toBe(250);
    expect(res.valor!.horasPorBloque.CX).toBe(150);
    expect(res.valor!.horasTotal).toBe(900);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. MATERIAS SIN HORAS — PARCIAL / NO_DETERMINABLE
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — materias sin horas', () => {

  it('una materia sin horas → en materiasSinHoras', async () => {
    const mat = makeMateria({ cargaHorariaTotal: null });
    const ev = makeEv(makeConsultas([mat]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.materiasSinHoras).toHaveLength(1);
    expect(res.valor!.materiasSinHoras[0].materiaId).toBe(mat.id);
  });

  it('materia sin horas pero con bloque → ese bloque es incierto', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: null, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'TB' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CB).toBeNull();
    expect(res.valor!.horasPorBloque.TB).toBe(300);
  });

  it('materia sin horas y sin bloque → todos los bloques inciertos', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: null, bloqueConocimiento: null }),
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'TB' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.horasPorBloque.CB).toBeNull();
    expect(res.valor!.horasPorBloque.TB).toBeNull();
    expect(res.valor!.horasPorBloque.TA).toBeNull();
    expect(res.valor!.horasPorBloque.CX).toBeNull();
  });

  it('alguna materia sin horas → estadoCalculo PARCIAL', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 300 }),
      makeMateria({ cargaHorariaTotal: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('TODAS las materias sin horas → estadoCalculo NO_DETERMINABLE', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: null }),
      makeMateria({ cargaHorariaTotal: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
  });

  it('todas las materias con horas → estadoCalculo CALCULADO', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 200, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'TB' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. BLOQUES INDETERMINADOS
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — materias con bloque indeterminado', () => {

  it('materia con bloque indeterminado y horas > 0 → PARCIAL', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 50, bloqueConocimiento: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('materia con bloque indeterminado siempre aparece en la lista (independientemente de horas)', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 0, bloqueConocimiento: null }),
      makeMateria({ cargaHorariaTotal: null, bloqueConocimiento: 'UNKNOWN' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.materiasConBloqueIndeterminado).toHaveLength(2);
  });

  it('bloqueConocimientoRaw se preserva en la lista de indeterminados', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: 'EXTRAÑO' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.materiasConBloqueIndeterminado[0].bloqueConocimientoRaw).toBe('EXTRAÑO');
  });

  it('bloque indeterminado con cargaHorariaTotal=0 no hace inciertos los bloques → CALCULADO', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 200, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 0, bloqueConocimiento: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor!.horasPorBloque.CB).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. COMPARACIÓN DE UMBRALES
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — comparación con umbrales', () => {

  it('cumple = true cuando horasReales >= horasMinimas', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 3800, bloqueConocimiento: 'CB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales({ horasMinTotales: 3600 })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.total.cumple).toBe(true);
    expect(res.valor!.evaluaciones.total.diferencia).toBe(200);
  });

  it('cumple = false cuando horasReales < horasMinimas', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 3000, bloqueConocimiento: 'CB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales({ horasMinTotales: 3600 })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.total.cumple).toBe(false);
    expect(res.valor!.evaluaciones.total.diferencia).toBe(-600);
  });

  it('igualdad exacta → cumple = true, diferencia = 0', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 3600, bloqueConocimiento: 'CB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales({ horasMinTotales: 3600 })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.total.cumple).toBe(true);
    expect(res.valor!.evaluaciones.total.diferencia).toBe(0);
  });

  it('diferencia negativa se conserva (no se convierte a cero)', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 500, bloqueConocimiento: 'CB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales({ horasMinCB: 700 })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.CB.diferencia).toBe(-200);
    expect(res.valor!.evaluaciones.CB.cumple).toBe(false);
  });

  it('evaluación por bloque CB independiente de otros bloques', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 900, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 400, bloqueConocimiento: 'TB' }),
    ];
    const umbrales = makeUmbrales({ horasMinCB: 800, horasMinTB: 500 });
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(umbrales));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.CB.cumple).toBe(true);
    expect(res.valor!.evaluaciones.TB.cumple).toBe(false);
    expect(res.valor!.evaluaciones.TB.diferencia).toBe(-100);
  });

  it('CX evaluado contra horasMinCTX (campo Prisma)', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 400, bloqueConocimiento: 'CTX' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales({ horasMinCTX: 365 })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.CX.horasReales).toBe(400);
    expect(res.valor!.evaluaciones.CX.horasMinimas).toBe(365);
    expect(res.valor!.evaluaciones.CX.cumple).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. UMBRALES NULL — no generan evaluación
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — umbrales NULL', () => {

  it('umbral total null → cumple=null, diferencia=null, horasReales disponible', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 3800, bloqueConocimiento: 'CB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales({ horasMinTotales: null })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.total.horasMinimas).toBeNull();
    expect(res.valor!.evaluaciones.total.cumple).toBeNull();
    expect(res.valor!.evaluaciones.total.diferencia).toBeNull();
    // Pero las horas reales deben estar disponibles
    expect(res.valor!.evaluaciones.total.horasReales).toBe(3800);
  });

  it('umbral CB null → CB no se evalúa pero otros sí', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 200, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'TB' }),
    ];
    const umbrales = makeUmbrales({ horasMinCB: null, horasMinTB: 400 });
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(umbrales));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.CB.cumple).toBeNull();
    expect(res.valor!.evaluaciones.CB.horasMinimas).toBeNull();
    expect(res.valor!.evaluaciones.TB.cumple).toBe(false);
    expect(res.valor!.evaluaciones.TB.horasMinimas).toBe(400);
  });

  it('todos los umbrales null → todas las dimensiones no evaluadas', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 3000, bloqueConocimiento: 'CB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales()));
    const res = await ev.evaluar(makeCtx());
    const evals = res.valor!.evaluaciones;
    expect(evals.total.cumple).toBeNull();
    expect(evals.CB.cumple).toBeNull();
    expect(evals.TB.cumple).toBeNull();
    expect(evals.TA.cumple).toBeNull();
    expect(evals.CX.cumple).toBeNull();
  });

  it('umbral null nunca tratado como cero — horasReales pequeño no falla sin umbral', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 1, bloqueConocimiento: 'CB' })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan(makeUmbrales({ horasMinTotales: null })));
    const res = await ev.evaluar(makeCtx());
    expect(res.valor!.evaluaciones.total.cumple).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. CONTRATO DE RESULTADO
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — contrato ResultadoIndicador', () => {

  it('codigo = R-09', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.codigo).toBe('R-09');
  });

  it('estadoImplementacion = IMPLEMENTADO siempre', async () => {
    const ev = makeEv(makeConsultas([makeMateria()]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('contextoId = planEstudioId', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx({ planEstudioId: 'plan-999' }));
    expect(res.contextoId).toBe('plan-999');
  });

  it('tipoContexto = PLAN', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.tipoContexto).toBe('PLAN');
  });

  it('fechaEvaluacion se preserva desde el contexto', async () => {
    const fecha = new Date('2025-01-01');
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx({ fechaEvaluacion: fecha }));
    expect(res.fechaEvaluacion).toBe(fecha);
  });

  it('valor.planEstudioId = planEstudioId del contexto', async () => {
    const ev = makeEv(makeConsultas([]), makeConfigPlan());
    const res = await ev.evaluar(makeCtx({ planEstudioId: 'plan-abc' }));
    expect(res.valor!.planEstudioId).toBe('plan-abc');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. DATOS FALTANTES
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — datosFaltantes', () => {

  it('sin problemas de datos → datosFaltantes vacío', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 200, bloqueConocimiento: 'TB' }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('materias sin horas → datosFaltante con campo cargaHorariaTotal', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: null })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes.some(d => d.campo === 'cargaHorariaTotal')).toBe(true);
    expect(res.datosFaltantes[0].entidad).toBe('Materia');
  });

  it('materia con bloque indeterminado y horas > 0 → datosFaltante con campo bloqueConocimiento', async () => {
    const materias = [makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: null })];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes.some(d => d.campo === 'bloqueConocimiento')).toBe(true);
  });

  it('materia con bloque indeterminado y horas = 0 → sin datosFaltante de bloque', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: 300, bloqueConocimiento: 'CB' }),
      makeMateria({ cargaHorariaTotal: 0, bloqueConocimiento: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes.some(d => d.campo === 'bloqueConocimiento')).toBe(false);
  });

  it('puede haber dos datosFaltantes simultáneamente', async () => {
    const materias = [
      makeMateria({ cargaHorariaTotal: null, bloqueConocimiento: null }),
      makeMateria({ cargaHorariaTotal: 100, bloqueConocimiento: null }),
    ];
    const ev = makeEv(makeConsultas(materias), makeConfigPlan());
    const res = await ev.evaluar(makeCtx());
    expect(res.datosFaltantes).toHaveLength(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. PROPAGACIÓN DE ERRORES
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — propagación de errores', () => {

  it('ForbiddenException de ConsultasAcademicasService se propaga', async () => {
    const c = { obtenerMateriasDePlan: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const cp = makeConfigPlan();
    await expect(new R09EvaluadorService(c as any, cp as any).evaluar(makeCtx())).rejects.toThrow(ForbiddenException);
  });

  it('NotFoundException de ConfigPlanService se propaga', async () => {
    const c = makeConsultas([]);
    const cp = { obtenerUmbrales: jest.fn().mockRejectedValue(new NotFoundException()) };
    await expect(new R09EvaluadorService(c as any, cp as any).evaluar(makeCtx())).rejects.toThrow(NotFoundException);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 12. INTEGRACIÓN CON RegistroIndicadores
// ════════════════════════════════════════════════════════════════════════════

describe('R09EvaluadorService — integración con RegistroIndicadores', () => {

  it('R-09 puede asignarse al registro y queda IMPLEMENTADO', () => {
    const registro = new RegistroIndicadores();
    const ev = new R09EvaluadorService(makeConsultas([]) as any, makeConfigPlan() as any);
    registro.asignarEvaluador('R-09', ev);
    expect(registro.tieneEvaluador('R-09')).toBe(true);
    expect(registro.obtener('R-09')!.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('alcance de R-09 es PLAN', () => {
    const registro = new RegistroIndicadores();
    expect(registro.obtener('R-09')!.alcance).toBe('PLAN');
  });
});
