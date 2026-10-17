import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { VinculacionAut } from '../consultas-academicas/consultas-academicas.types';
import type { ConfigFacultadAut } from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';
import { R07EvaluadorService } from './r07.evaluador';

// ── Constantes ───────────────────────────────────────────────────────────────

const USR    = 'usr-01';
const CAR_ID = 'car-01';
const FAC_ID = 'fac-01';
const FECHA  = new Date('2026-10-14');
const ADMIN  = 'ADMINISTRADOR_SISTEMA';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContexto(overrides: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: USR,
    rolNombre: ADMIN,
    carreraId: CAR_ID,
    fechaEvaluacion: FECHA,
    ...overrides,
  };
}

function makeVin(
  docenteId: string,
  materiaId: string,
  overrides: Partial<VinculacionAut> = {},
): VinculacionAut {
  return {
    id: `vin-${docenteId}-${materiaId}-${overrides.catedraId ?? 'cat01'}`,
    docenteId,
    materiaId,
    catedraId: 'cat-01',
    planEstudioId: 'plan-01',
    carreraId: CAR_ID,
    estado: 'APROBADA',
    esResponsableCatedra: null,
    horasSemana: 6,
    docente: {
      id: docenteId,
      nombre: `Nombre-${docenteId}`,
      apellido: `Apellido-${docenteId}`,
      activo: true,
      dedicacion: null,
      categoriaDocente: null,
    },
    ...overrides,
  };
}

function makeConfig(p03MaxMat: number): ConfigFacultadAut {
  return {
    facultadId: 'fac-01',
    p01TopeH: 20,
    p02BajaH: 4,
    p03MaxMat,
  } as ConfigFacultadAut;
}

function makeSvc(
  vinculaciones: VinculacionAut[],
  config: ConfigFacultadAut | null,
  alcanceFacultad = true,
  multiFacultadDocentes: string[] = [],
) {
  const consultas = {
    obtenerVinculacionesParaR07: jest.fn().mockResolvedValue({
      vinculaciones,
      facultadId: FAC_ID,
      alcanceFacultad,
      docentesMultiFacultad: new Set(multiFacultadDocentes),
    }),
    obtenerConfigDeCarrera: jest.fn().mockResolvedValue(config),
  };
  return { svc: new R07EvaluadorService(consultas as any), consultas };
}

// ════════════════════════════════════════════════════════════════════════════
// A. PARÁMETROS OBLIGATORIOS
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — A. parámetros obligatorios', () => {

  it('lanza BadRequestException cuando el contexto no tiene carreraId', async () => {
    const { svc } = makeSvc([], makeConfig(3));
    await expect(
      svc.evaluar(makeContexto({ carreraId: undefined })),
    ).rejects.toThrow(BadRequestException);
  });

  it('no consulta datos cuando carreraId está ausente', async () => {
    const { svc, consultas } = makeSvc([], makeConfig(3));
    await expect(svc.evaluar(makeContexto({ carreraId: undefined }))).rejects.toThrow();
    expect(consultas.obtenerVinculacionesParaR07).not.toHaveBeenCalled();
    expect(consultas.obtenerConfigDeCarrera).not.toHaveBeenCalled();
  });

});

// ════════════════════════════════════════════════════════════════════════════
// B. NO_APLICA — sin vinculaciones APROBADAS
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — B. NO_APLICA sin vinculaciones', () => {

  it('devuelve NO_APLICA cuando no hay vinculaciones en absoluto', async () => {
    const { svc } = makeSvc([], makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(r.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(r.codigo).toBe('R-07');
  });

  it('devuelve NO_APLICA cuando todas las vinculaciones son PENDIENTE', async () => {
    const { svc } = makeSvc(
      [makeVin('d1', 'm1', { estado: 'PENDIENTE' })],
      makeConfig(3),
    );
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
  });

  it('NO_APLICA preserva el limite del config cuando está disponible', async () => {
    const { svc } = makeSvc([], makeConfig(5));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect((r.valor as any).limite).toBe(5);
  });

  it('NO_APLICA sin config devuelve limite null', async () => {
    const { svc } = makeSvc([], null);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect((r.valor as any).limite).toBeNull();
  });

  it('NO_APLICA tiene totalDocentes = 0 y sobreasignados vacío', async () => {
    const { svc } = makeSvc([], makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalDocentes).toBe(0);
    expect(v.totalSobreasignados).toBe(0);
    expect(v.sobreasignados).toEqual([]);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// C. NO_DETERMINABLE — config null con docentes activos
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — C. NO_DETERMINABLE sin config', () => {

  it('devuelve NO_DETERMINABLE cuando config es null y hay vinculaciones APROBADAS', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], null);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect(r.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('NO_DETERMINABLE incluye datosFaltantes con campo p03MaxMat y advertencias DP-1/DP-4', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], null);
    const r = await svc.evaluar(makeContexto());
    expect(r.datosFaltantes).toHaveLength(3);
    expect(r.datosFaltantes![0].campo).toBe('p03MaxMat');
    expect(r.datosFaltantes![0].entidad).toBe('AutoevaluacionConfigFacultad');
    expect(r.datosFaltantes![1].campo).toBe('cargoVigente');
    expect(r.datosFaltantes![2].campo).toBe('planEvaluado');
  });

  it('NO_DETERMINABLE tiene limite null', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], null);
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).limite).toBeNull();
  });

  it('NO_DETERMINABLE informa el totalDocentes aunque no pueda calcular alerta', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d2', 'm2')];
    const { svc } = makeSvc(vins, null);
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalDocentes).toBe(2);
  });

  it('NO_DETERMINABLE tiene sobreasignados vacío (no se puede determinar)', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')], null);
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).sobreasignados).toEqual([]);
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// D. CALCULADO — docente dentro del límite
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — D. docente dentro del límite', () => {

  it('docente con nMaterias < limite → no es sobreasignado', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1'), makeVin('d1', 'm2')], makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect((r.valor as any).totalSobreasignados).toBe(0);
    expect((r.valor as any).sobreasignados).toEqual([]);
  });

  it('resultado CALCULADO tiene limite correcto', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], makeConfig(4));
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).limite).toBe(4);
  });

  it('totalDocentes cuenta docentes únicos correctamente', async () => {
    const vins = [
      makeVin('d1', 'm1'), makeVin('d1', 'm2'),
      makeVin('d2', 'm1'), makeVin('d2', 'm3'),
    ];
    const { svc } = makeSvc(vins, makeConfig(5));
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalDocentes).toBe(2);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// E. EXACTAMENTE EN EL LÍMITE — no es sobreasignado (regla estricta >)
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — E. exactamente en el límite', () => {

  it('docente con nMaterias === limite NO es sobreasignado (regla es >)', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect((r.valor as any).totalSobreasignados).toBe(0);
    expect((r.valor as any).sobreasignados).toEqual([]);
  });

  it('limite = 1 y docente con 1 materia → no es alerta', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], makeConfig(1));
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// F. DOCENTE SOBRE EL LÍMITE — alerta generada
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — F. docente sobre el límite', () => {

  it('docente con nMaterias > limite aparece en sobreasignados', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3'), makeVin('d1', 'm4')];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].docenteId).toBe('d1');
    expect(v.sobreasignados[0].nMaterias).toBe(4);
    expect(v.sobreasignados[0].exceso).toBe(1);
  });

  it('exceso se calcula correctamente como nMaterias - limite', async () => {
    const vins = [
      makeVin('d1', 'm1'), makeVin('d1', 'm2'),
      makeVin('d1', 'm3'), makeVin('d1', 'm4'), makeVin('d1', 'm5'),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const alerta = (r.valor as any).sobreasignados[0];
    expect(alerta.exceso).toBe(3);
  });

  it('sobreasignado incluye asignaciones como evidencia estructurada', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const alerta = (r.valor as any).sobreasignados[0];
    expect(alerta.asignaciones).toHaveLength(3);
    const materiaIds = alerta.asignaciones.map((a: any) => a.materiaId);
    expect(materiaIds).toEqual(expect.arrayContaining(['m1', 'm2', 'm3']));
  });

  it('nombre del docente se forma como "nombre apellido"', async () => {
    const vin = makeVin('d1', 'm1', {
      docente: {
        id: 'd1', nombre: 'Juan', apellido: 'Pérez',
        activo: true, dedicacion: null, categoriaDocente: null,
      },
    });
    const vins = [vin, makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    vins[1] = { ...vins[1], docente: { ...vins[1].docente, nombre: 'Juan', apellido: 'Pérez' } };
    vins[2] = { ...vins[2], docente: { ...vins[2].docente, nombre: 'Juan', apellido: 'Pérez' } };
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).sobreasignados[0].nombre).toBe('Juan Pérez');
  });

  it('datosFaltantes contiene advertencias DP-1/DP-4 cuando el cálculo es exitoso', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    expect(r.datosFaltantes).toHaveLength(2);
    expect(r.datosFaltantes![0].campo).toBe('cargoVigente');
    expect(r.datosFaltantes![1].campo).toBe('planEvaluado');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// G. MÚLTIPLES DOCENTES — mezcla dentro y fuera del límite
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — G. múltiples docentes', () => {

  it('distingue docentes sobre y bajo el límite correctamente', async () => {
    const vins = [
      makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3'), makeVin('d1', 'm4'), // 4 > 3
      makeVin('d2', 'm5'), makeVin('d2', 'm6'), makeVin('d2', 'm7'),                       // 3 = 3 → OK
      makeVin('d3', 'm8'),                                                                  // 1 < 3 → OK
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalDocentes).toBe(3);
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].docenteId).toBe('d1');
  });

  it('todos sobre el límite → totalSobreasignados = totalDocentes', async () => {
    const vins = [
      makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3'),
      makeVin('d2', 'm4'), makeVin('d2', 'm5'), makeVin('d2', 'm6'),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalDocentes).toBe(2);
    expect(v.totalSobreasignados).toBe(2);
  });

  it('ninguno sobre el límite → sobreasignados vacío', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d2', 'm2'), makeVin('d3', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(5));
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).sobreasignados).toEqual([]);
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// H. DEDUPLICACIÓN — clave (plan, materia, cátedra) según FSD §3.3
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — H. deduplicación por (planEstudioId, materiaId, catedraId)', () => {

  it('misma materia en dos cátedras distintas cuenta dos veces (FSD §3.3)', async () => {
    // 4 combinaciones distintas: plan-01|m1|cat-01, plan-01|m1|cat-02, plan-01|m2|cat-01, plan-01|m3|cat-01
    const vins = [
      makeVin('d1', 'm1', { catedraId: 'cat-01' }),
      makeVin('d1', 'm1', { catedraId: 'cat-02' }), // misma materia, cátedra distinta → 2ª combinación
      makeVin('d1', 'm2'),
      makeVin('d1', 'm3'),
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    // nMaterias = 4 > límite 3 → sobreasignado
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].nMaterias).toBe(4);
    expect(v.sobreasignados[0].exceso).toBe(1);
  });

  it('dos cargos sobre la misma combinación (plan, materia, cátedra) cuentan como uno', async () => {
    // Dos vinculaciones con mismos plan/mat/cat pero distinto id de registro (dos cargos)
    const vin1 = makeVin('d1', 'm1', { id: 'vin-A', catedraId: 'cat-01', planEstudioId: 'plan-01' });
    const vin2 = makeVin('d1', 'm1', { id: 'vin-B', catedraId: 'cat-01', planEstudioId: 'plan-01' });
    const vins = [vin1, vin2, makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(3));
    // nMaterias = 3 (plan-01|m1|cat-01, plan-01|m2|cat-01, plan-01|m3|cat-01) = límite → no alerta
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

  it('misma materia en dos planes distintos cuenta dos veces', async () => {
    const vins = [
      makeVin('d1', 'm1', { planEstudioId: 'plan-01' }),
      makeVin('d1', 'm1', { planEstudioId: 'plan-02' }), // mismo mat, plan distinto → 2ª combinación
      makeVin('d1', 'm2'),
      makeVin('d1', 'm3'),
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    // nMaterias = 4: plan-01|m1|cat-01, plan-02|m1|cat-01, plan-01|m2|cat-01, plan-01|m3|cat-01
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].nMaterias).toBe(4);
  });

  it('deduplicación no afecta combinaciones completamente distintas', async () => {
    const vins = [
      makeVin('d1', 'm1'),
      makeVin('d1', 'm2'),
      makeVin('d1', 'm3'),
      makeVin('d1', 'm4'), // 4 combinaciones distintas > límite 3
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].nMaterias).toBe(4);
  });

  it('asignaciones no tiene entradas repetidas', async () => {
    // m1 en cat-01 y cat-02 → 2 combinaciones; m2, m3, m4 → 3 más = 5 total
    const vins = [
      makeVin('d1', 'm1', { catedraId: 'cat-01' }),
      makeVin('d1', 'm1', { catedraId: 'cat-02' }),
      makeVin('d1', 'm2'),
      makeVin('d1', 'm3'),
      makeVin('d1', 'm4'),
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    const alerta = (r.valor as any).sobreasignados[0];
    expect(alerta.nMaterias).toBe(5);
    const claves = alerta.asignaciones.map(
      (a: any) => `${a.planEstudioId}|${a.materiaId}|${a.catedraId}`,
    );
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('asignaciones tiene la estructura {planEstudioId, materiaId, catedraId}', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const asignaciones = (r.valor as any).sobreasignados[0].asignaciones;
    expect(asignaciones).toHaveLength(3);
    for (const a of asignaciones) {
      expect(typeof a.planEstudioId).toBe('string');
      expect(typeof a.materiaId).toBe('string');
      expect(typeof a.catedraId).toBe('string');
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// I. SOLO APROBADAS CUENTAN
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — I. solo vinculaciones APROBADAS', () => {

  it('vinculaciones PENDIENTE no cuentan para nMaterias', async () => {
    const vins = [
      makeVin('d1', 'm1'),                                   // APROBADA
      makeVin('d1', 'm2'),                                   // APROBADA
      makeVin('d1', 'm3', { estado: 'PENDIENTE' }),          // no cuenta
      makeVin('d1', 'm4', { estado: 'PENDIENTE' }),          // no cuenta
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    // nMat efectivo = 2 = limite → no sobreasignado
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

  it('vinculaciones RECHAZADA no cuentan para nMaterias', async () => {
    const vins = [
      makeVin('d1', 'm1'),
      makeVin('d1', 'm2'),
      makeVin('d1', 'm3', { estado: 'RECHAZADA' as any }),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    // nMat efectivo = 2 = limite → no sobreasignado
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

  it('mezcla de APROBADA y otros estados — solo APROBADAS determinan la alerta', async () => {
    const vins = [
      makeVin('d1', 'm1'),
      makeVin('d1', 'm2'),
      makeVin('d1', 'm3'),
      makeVin('d1', 'm4'),                                   // APROBADA → 4 > 2
      makeVin('d1', 'm5', { estado: 'PENDIENTE' }),          // no cuenta
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].nMaterias).toBe(4);
    expect(v.sobreasignados[0].exceso).toBe(2);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// J. ORDENAMIENTO — por exceso DESC, luego nombre ASC
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — J. ordenamiento de sobreasignados', () => {

  it('ordena por exceso descendente', async () => {
    const limite = 2;
    const vins = [
      // d1: 3 materias → exceso 1
      makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3'),
      // d2: 5 materias → exceso 3
      makeVin('d2', 'm4'), makeVin('d2', 'm5'), makeVin('d2', 'm6'),
      makeVin('d2', 'm7'), makeVin('d2', 'm8'),
      // d3: 4 materias → exceso 2
      makeVin('d3', 'm9'), makeVin('d3', 'm10'), makeVin('d3', 'm11'), makeVin('d3', 'm12'),
    ];
    const { svc } = makeSvc(vins, makeConfig(limite));
    const r = await svc.evaluar(makeContexto());
    const lista = (r.valor as any).sobreasignados as Array<{ docenteId: string; exceso: number }>;
    expect(lista[0].docenteId).toBe('d2'); // exceso 3
    expect(lista[1].docenteId).toBe('d3'); // exceso 2
    expect(lista[2].docenteId).toBe('d1'); // exceso 1
  });

  it('empate en exceso → ordena por nombre ASC', async () => {
    const limite = 1;
    const vins = [
      makeVin('d1', 'm1', {
        docente: { id: 'd1', nombre: 'Zoe', apellido: 'García', activo: true, dedicacion: null, categoriaDocente: null },
      }),
      makeVin('d1', 'm2', {
        docente: { id: 'd1', nombre: 'Zoe', apellido: 'García', activo: true, dedicacion: null, categoriaDocente: null },
      }),
      makeVin('d2', 'm3', {
        docente: { id: 'd2', nombre: 'Ana', apellido: 'López', activo: true, dedicacion: null, categoriaDocente: null },
      }),
      makeVin('d2', 'm4', {
        docente: { id: 'd2', nombre: 'Ana', apellido: 'López', activo: true, dedicacion: null, categoriaDocente: null },
      }),
    ];
    const { svc } = makeSvc(vins, makeConfig(limite));
    const r = await svc.evaluar(makeContexto());
    const lista = (r.valor as any).sobreasignados as Array<{ nombre: string }>;
    expect(lista[0].nombre).toBe('Ana López');
    expect(lista[1].nombre).toBe('Zoe García');
  });

  it('resultado de ordenamiento tiene estadoCalculo CALCULADO', async () => {
    const vins = [
      makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3'),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// K. CÁLCULO CROSS-CARRERA — alcanceFacultad=true
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — K. cálculo cross-carrera (misma facultad)', () => {

  it('docente en una sola carrera: evaluación normal, CALCULADO', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].nMaterias).toBe(3);
    expect(v.alcanceFacultad).toBe(true);
  });

  it('docente en dos carreras de la misma facultad: la suma de asignaciones determina la alerta', async () => {
    // Simulamos vinculaciones de dos carreras distintas en la misma facultad:
    // carrera A: 3 combinaciones, carrera B: 3 combinaciones → total = 6 > límite 4
    const vins = [
      makeVin('d1', 'm1', { carreraId: 'car-01', planEstudioId: 'plan-01' }),
      makeVin('d1', 'm2', { carreraId: 'car-01', planEstudioId: 'plan-01' }),
      makeVin('d1', 'm3', { carreraId: 'car-01', planEstudioId: 'plan-01' }),
      makeVin('d1', 'm4', { carreraId: 'car-02', planEstudioId: 'plan-02' }),
      makeVin('d1', 'm5', { carreraId: 'car-02', planEstudioId: 'plan-02' }),
      makeVin('d1', 'm6', { carreraId: 'car-02', planEstudioId: 'plan-02' }),
    ];
    const { svc } = makeSvc(vins, makeConfig(4));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].nMaterias).toBe(6);
    expect(v.sobreasignados[0].exceso).toBe(2);
  });

  it('caso 3+3 con P-03=4: alerta generada correctamente', async () => {
    const vins = [
      makeVin('d1', 'm1', { planEstudioId: 'plan-A' }),
      makeVin('d1', 'm2', { planEstudioId: 'plan-A' }),
      makeVin('d1', 'm3', { planEstudioId: 'plan-A' }),
      makeVin('d1', 'm4', { planEstudioId: 'plan-B' }),
      makeVin('d1', 'm5', { planEstudioId: 'plan-B' }),
      makeVin('d1', 'm6', { planEstudioId: 'plan-B' }),
    ];
    const { svc } = makeSvc(vins, makeConfig(4));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.sobreasignados[0].nMaterias).toBe(6);
    expect(v.sobreasignados[0].exceso).toBe(2);
  });

  it('misma materia en dos cátedras distintas: cuenta dos (cross-carrera también)', async () => {
    const vins = [
      makeVin('d1', 'm1', { planEstudioId: 'plan-A', catedraId: 'cat-01' }),
      makeVin('d1', 'm1', { planEstudioId: 'plan-A', catedraId: 'cat-02' }), // misma mat, distinta cátedra
      makeVin('d1', 'm2', { planEstudioId: 'plan-B' }),
      makeVin('d1', 'm3', { planEstudioId: 'plan-B' }),
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.sobreasignados[0].nMaterias).toBe(4); // m1@cat01, m1@cat02, m2, m3
    expect(v.sobreasignados[0].exceso).toBe(1);
  });

  it('nMaterias exactamente igual a P-03 cross-carrera: sin alerta (regla estricta >)', async () => {
    const vins = [
      makeVin('d1', 'm1', { planEstudioId: 'plan-A' }),
      makeVin('d1', 'm2', { planEstudioId: 'plan-B' }),
      makeVin('d1', 'm3', { planEstudioId: 'plan-A' }),
      makeVin('d1', 'm4', { planEstudioId: 'plan-B' }),
    ];
    const { svc } = makeSvc(vins, makeConfig(4));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

  it('resultado tiene facultadId', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).facultadId).toBe(FAC_ID);
  });

  it('evaluar usa docentesMultiFacultad provisto por obtenerVinculacionesParaR07', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalNoDeterminables).toBe(1);
    expect((r.valor as any).noDeterminables[0].docenteId).toBe('d1');
  });

  it('alcanceFacultad=false: docentesMultiFacultad vacío → sin noDeterminables', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2), false, []);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect((r.valor as any).noDeterminables).toHaveLength(0);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// L. MULTI-FACULTAD — docentes con asignaciones en más de una facultad
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — L. docentes multi-facultad', () => {

  it('docente cross-facultad queda en noDeterminables, no en sobreasignados', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')]; // 3 > límite 2
    const { svc } = makeSvc(vins, makeConfig(2), true, ['d1']); // d1 es multi-facultad
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(0);
    expect(v.sobreasignados).toHaveLength(0);
    expect(v.totalNoDeterminables).toBe(1);
    expect(v.noDeterminables[0].docenteId).toBe('d1');
    expect(v.noDeterminables[0].causa).toBe('CROSS_FACULTAD');
  });

  it('nMateriasConocidas del NO_DETERMINABLE refleja las combinaciones visibles en esta facultad', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).noDeterminables[0].nMateriasConocidas).toBe(3);
  });

  it('docente cross-facultad produce estadoCalculo PARCIAL', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('otros docentes (una sola facultad) siguen evaluándose con PARCIAL global', async () => {
    const vins = [
      makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3'), // d1: multi-facultad
      makeVin('d2', 'm4'), makeVin('d2', 'm5'), makeVin('d2', 'm6'), // d2: 3 > límite 2 → alerta
    ];
    const { svc } = makeSvc(vins, makeConfig(2), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].docenteId).toBe('d2');
    expect(v.totalNoDeterminables).toBe(1);
    expect(v.noDeterminables[0].docenteId).toBe('d1');
  });

  it('ningún docente cross-facultad y alcanceFacultad=true: estadoCalculo CALCULADO', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3)); // multiFacultadDocentes=[] por defecto
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect((r.valor as any).totalNoDeterminables).toBe(0);
    expect((r.valor as any).noDeterminables).toHaveLength(0);
  });

  it('datosFaltantes describe la causa cuando hay docentes cross-facultad (+ DP-1/DP-4)', async () => {
    const vins = [makeVin('d1', 'm1')];
    const { svc } = makeSvc(vins, makeConfig(3), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    expect(r.datosFaltantes).toHaveLength(3);
    expect(r.datosFaltantes![0].campo).toBe('vinculacionesOtrasFacultades');
    expect(r.datosFaltantes![1].campo).toBe('cargoVigente');
    expect(r.datosFaltantes![2].campo).toBe('planEvaluado');
  });

  it('con todos docentes multi-facultad y ninguno sobreasignado: PARCIAL sin sobreasignados', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d2', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), true, ['d1', 'd2']);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect((r.valor as any).totalSobreasignados).toBe(0);
    expect((r.valor as any).totalNoDeterminables).toBe(2);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// M. SEGURIDAD — comportamiento por rol
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — M. seguridad y alcance por rol', () => {

  it('alcanceFacultad=true produce CALCULADO (rol con acceso a toda la facultad)', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), true);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect((r.valor as any).alcanceFacultad).toBe(true);
  });

  it('alcanceFacultad=false (DIRECTOR_CARRERA) produce PARCIAL', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), false);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect((r.valor as any).alcanceFacultad).toBe(false);
  });

  it('DIRECTOR_CARRERA: sobreasignados basados en datos visibles siguen reportándose', async () => {
    // Un docente con nMat > límite dentro de la carrera visible sigue siendo alerta
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2), false);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].docenteId).toBe('d1');
  });

  it('DIRECTOR_CARRERA: noDeterminables vacío (sin check cross-facultad desde scope parcial)', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), false);
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).noDeterminables).toHaveLength(0);
  });

  it('DIRECTOR_CARRERA: datosFaltantes incluye aviso de scope limitado y DP-1/DP-4', async () => {
    const vins = [makeVin('d1', 'm1')];
    const { svc } = makeSvc(vins, makeConfig(3), false);
    const r = await svc.evaluar(makeContexto());
    expect(r.datosFaltantes).toHaveLength(3);
    expect(r.datosFaltantes![0].campo).toBe('vinculacionesOtrasCarreras');
    expect(r.datosFaltantes![1].campo).toBe('cargoVigente');
    expect(r.datosFaltantes![2].campo).toBe('planEvaluado');
  });

  it('sin carreraId en contexto → BadRequestException antes de llamar a consultas', async () => {
    const { svc, consultas } = makeSvc([], makeConfig(3));
    await expect(svc.evaluar(makeContexto({ carreraId: undefined })))
      .rejects.toThrow(BadRequestException);
    expect(consultas.obtenerVinculacionesParaR07).not.toHaveBeenCalled();
    expect(consultas.obtenerConfigDeCarrera).not.toHaveBeenCalled();
  });

  it('los docenteIds de asignaciones visibles no incluyen info de otras facultades', async () => {
    // Datos del scope: d1 en esta facultad, multi-facultad → NO_DETERMINABLE
    // El resultado no debe revelar nada de la otra facultad
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    // noDeterminables contiene nombre/nMateriasConocidas del scope visible, no datos externos
    expect(v.noDeterminables[0].nMateriasConocidas).toBe(2); // solo las 2 del scope
    // No debe haber asignaciones de otras facultades en sobreasignados
    expect(v.sobreasignados).toHaveLength(0);
  });

  it('resultado PARCIAL por scope parcial no incluye datos de carreras fuera del scope', async () => {
    // makeSvc con alcanceFacultad=false simula DIRECTOR_CARRERA (solo ve su carrera)
    const vins = [makeVin('d1', 'm1', { carreraId: 'car-01' })];
    const { svc } = makeSvc(vins, makeConfig(3), false);
    const r = await svc.evaluar(makeContexto());
    // El resultado solo conoce datos de car-01; el PARCIAL avisa que hay más
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect((r.valor as any).totalDocentes).toBe(1);
    // Las asignaciones de car-02 (si existieran) no aparecen porque el mock no las incluye
    expect((r.valor as any).totalSobreasignados).toBe(0);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// N. ORDENAMIENTO ALFABÉTICO DE ASIGNACIONES — FSD §5.3
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — N. ordenamiento alfabético de asignaciones (FSD §5.3)', () => {

  it('asignaciones de un sobreasignado se ordenan alfabéticamente por materiaNombre', async () => {
    const vins = [
      makeVin('d1', 'm1', { materiaNombre: 'Química Orgánica' }),
      makeVin('d1', 'm2', { materiaNombre: 'Álgebra Lineal' }),
      makeVin('d1', 'm3', { materiaNombre: 'Cálculo I' }),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const asigs = (r.valor as any).sobreasignados[0].asignaciones;
    expect(asigs[0].materiaNombre).toBe('Álgebra Lineal');
    expect(asigs[1].materiaNombre).toBe('Cálculo I');
    expect(asigs[2].materiaNombre).toBe('Química Orgánica');
  });

  it('asignaciones incluye campo materiaNombre en la estructura (FSD §5.3)', async () => {
    const vins = [
      makeVin('d1', 'm1', { materiaNombre: 'Álgebra' }),
      makeVin('d1', 'm2', { materiaNombre: 'Biología' }),
      makeVin('d1', 'm3', { materiaNombre: 'Cálculo' }),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const asigs = (r.valor as any).sobreasignados[0].asignaciones;
    for (const a of asigs) {
      expect(a).toHaveProperty('materiaNombre');
    }
  });

  it('asignaciones sin materiaNombre (undefined) se incluyen sin romper el ordenamiento', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const asigs = (r.valor as any).sobreasignados[0].asignaciones;
    expect(asigs).toHaveLength(3);
  });

  it('mismo nombre de materia: orden secundario por catedraId (determinismo)', async () => {
    const vins = [
      makeVin('d1', 'm1', { catedraId: 'cat-C', materiaNombre: 'Física' }),
      makeVin('d1', 'm2', { catedraId: 'cat-A', materiaNombre: 'Física' }),
      makeVin('d1', 'm3', { catedraId: 'cat-B', materiaNombre: 'Física' }),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const asigs = (r.valor as any).sobreasignados[0].asignaciones;
    expect(asigs[0].catedraId).toBe('cat-A');
    expect(asigs[1].catedraId).toBe('cat-B');
    expect(asigs[2].catedraId).toBe('cat-C');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// O. ADVERTENCIAS DP-1/DP-4 EN RESULTADOS
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — O. advertencias DP-1/DP-4 en los resultados', () => {

  it('resultado CALCULADO incluye advertencia DP-1 (cargoVigente) y DP-4 (planEvaluado)', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    const campos = r.datosFaltantes!.map((d) => d.campo);
    expect(campos).toContain('cargoVigente');
    expect(campos).toContain('planEvaluado');
  });

  it('las advertencias DP tienen entidades Cargo y PlanEstudio respectivamente', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    const dp1 = r.datosFaltantes!.find((d) => d.campo === 'cargoVigente');
    const dp4 = r.datosFaltantes!.find((d) => d.campo === 'planEvaluado');
    expect(dp1?.entidad).toBe('Cargo');
    expect(dp4?.entidad).toBe('PlanEstudio');
  });

  it('resultado PARCIAL (scope limitado) incluye DP-1/DP-4 además del aviso de scope', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], makeConfig(3), false);
    const r = await svc.evaluar(makeContexto());
    expect(r.datosFaltantes).toHaveLength(3);
    const campos = r.datosFaltantes!.map((d) => d.campo);
    expect(campos).toContain('vinculacionesOtrasCarreras');
    expect(campos).toContain('cargoVigente');
    expect(campos).toContain('planEvaluado');
  });

  it('resultado PARCIAL (multi-facultad) incluye DP-1/DP-4 además del aviso multi-facultad', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], makeConfig(3), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    expect(r.datosFaltantes).toHaveLength(3);
    const campos = r.datosFaltantes!.map((d) => d.campo);
    expect(campos).toContain('vinculacionesOtrasFacultades');
    expect(campos).toContain('cargoVigente');
    expect(campos).toContain('planEvaluado');
  });

  it('resultado NO_DETERMINABLE incluye DP-1/DP-4 además de p03MaxMat', async () => {
    const { svc } = makeSvc([makeVin('d1', 'm1')], null);
    const r = await svc.evaluar(makeContexto());
    expect(r.datosFaltantes).toHaveLength(3);
    const campos = r.datosFaltantes!.map((d) => d.campo);
    expect(campos).toContain('p03MaxMat');
    expect(campos).toContain('cargoVigente');
    expect(campos).toContain('planEvaluado');
  });

  it('resultado NO_APLICA NO incluye advertencias DP (sin vinculaciones evaluables)', async () => {
    const { svc } = makeSvc([], makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(r.datosFaltantes).toEqual([]);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// P. EXCLUSIÓN DE DOCENTES INACTIVOS (Docente.activo = false)
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — P. exclusión de docentes inactivos', () => {

  function inactivo(vin: VinculacionAut): VinculacionAut {
    return { ...vin, docente: { ...vin.docente, activo: false } };
  }

  it('docente con activo=false no cuenta aunque tenga vinculación APROBADA', async () => {
    const vins = [
      inactivo(makeVin('d1', 'm1')),
      inactivo(makeVin('d1', 'm2')),
      inactivo(makeVin('d1', 'm3')),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
  });

  it('docente inactivo no aparece en sobreasignados aunque supere el límite', async () => {
    const vins = [
      inactivo(makeVin('d1', 'm1')),
      inactivo(makeVin('d1', 'm2')),
      inactivo(makeVin('d1', 'm3')),
      makeVin('d2', 'm4'),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(0);
    expect(v.totalDocentes).toBe(1);
  });

  it('docente activo sobre el límite se alerta aunque haya otro docente inactivo', async () => {
    const vins = [
      makeVin('d1', 'm1'),
      makeVin('d1', 'm2'),
      makeVin('d1', 'm3'),
      inactivo(makeVin('d2', 'm4')),
      inactivo(makeVin('d2', 'm5')),
      inactivo(makeVin('d2', 'm6')),
    ];
    const { svc } = makeSvc(vins, makeConfig(2));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].docenteId).toBe('d1');
    expect(v.totalDocentes).toBe(1);
  });

  it('docente inactivo no aparece en totalDocentes', async () => {
    const vins = [
      makeVin('d1', 'm1'),
      inactivo(makeVin('d2', 'm2')),
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    expect((r.valor as any).totalDocentes).toBe(1);
  });

  it('NO_DETERMINABLE con docente inactivo: totalDocentes solo cuenta activos', async () => {
    const vins = [makeVin('d1', 'm1'), inactivo(makeVin('d2', 'm2'))];
    const { svc } = makeSvc(vins, null);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect((r.valor as any).totalDocentes).toBe(1);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// Q. CASOS EXTREMOS DE SEGURIDAD Y CONSISTENCIA
// ════════════════════════════════════════════════════════════════════════════

describe('R07EvaluadorService — Q. casos extremos de seguridad y consistencia', () => {

  it('DIRECTOR_CARRERA autorizado: PARCIAL con sobreasignados visibles (sin IDOR desde evaluador)', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3')];
    const { svc } = makeSvc(vins, makeConfig(2), false);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    const v = r.valor as any;
    expect(v.totalSobreasignados).toBe(1);
    expect(v.sobreasignados[0].docenteId).toBe('d1');
  });

  it('DIRECTOR_CARRERA: NO_APLICA cuando no hay APROBADAS en la carrera visible', async () => {
    const vins = [makeVin('d1', 'm1', { estado: 'PENDIENTE' })];
    const { svc } = makeSvc(vins, makeConfig(3), false);
    const r = await svc.evaluar(makeContexto());
    expect(r.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
  });

  it('totalDocentes = sobreasignados + noDeterminables + docentes OK (consistencia interna)', async () => {
    const vins = [
      makeVin('d1', 'm1'), makeVin('d1', 'm2'), makeVin('d1', 'm3'), // d1: cross-facultad → noDeterminable
      makeVin('d2', 'm4'), makeVin('d2', 'm5'),                       // d2: 2 ≤ límite 3 → OK
      makeVin('d3', 'm6'), makeVin('d3', 'm7'), makeVin('d3', 'm8'), makeVin('d3', 'm9'), // d3: 4 > 3 → alerta
    ];
    const { svc } = makeSvc(vins, makeConfig(3), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalDocentes).toBe(3);
    expect(v.totalSobreasignados).toBe(1);
    expect(v.totalNoDeterminables).toBe(1);
  });

  it('docente multi-facultad: noDeterminables no expone datos de otras facultades', async () => {
    const vins = [makeVin('d1', 'm1'), makeVin('d1', 'm2')];
    const { svc } = makeSvc(vins, makeConfig(3), true, ['d1']);
    const r = await svc.evaluar(makeContexto());
    const nd = (r.valor as any).noDeterminables[0];
    expect(nd).not.toHaveProperty('facultadIdOtra');
    expect(nd).not.toHaveProperty('asignacionesExternas');
    expect(nd.nMateriasConocidas).toBe(2);
  });

  it('todos los estados de vinculación: solo APROBADA+activo entra en el cálculo', async () => {
    function inactivo(v: VinculacionAut) { return { ...v, docente: { ...v.docente, activo: false } }; }
    const vins = [
      makeVin('d1', 'm1'),                                            // APROBADA + activo → cuenta
      makeVin('d1', 'm2', { estado: 'PENDIENTE' }),                   // no cuenta (estado)
      makeVin('d2', 'm3', { estado: 'RECHAZADA' as any }),            // no cuenta (estado)
      inactivo(makeVin('d3', 'm4')),                                   // no cuenta (inactivo)
      makeVin('d3', 'm5', { estado: 'DESVINCULADA' as any }),         // no cuenta (estado)
    ];
    const { svc } = makeSvc(vins, makeConfig(3));
    const r = await svc.evaluar(makeContexto());
    const v = r.valor as any;
    expect(v.totalDocentes).toBe(1);
    expect(r.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

});
