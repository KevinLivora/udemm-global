import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { VinculacionAut } from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';
import { R06EvaluadorService } from './r06.evaluador';

// ── Constantes ───────────────────────────────────────────────────────────────

const USR    = 'usr-01';
const CAR_ID = 'car-01';
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

function makeSvc(vinculaciones: VinculacionAut[]) {
  const consultas = {
    obtenerVinculacionesDeCarrera: jest.fn().mockResolvedValue(vinculaciones),
  };
  return { svc: new R06EvaluadorService(consultas as any), consultas };
}

// ════════════════════════════════════════════════════════════════════════════
// A. PARÁMETROS OBLIGATORIOS
// ════════════════════════════════════════════════════════════════════════════

describe('R06EvaluadorService — A. parámetros obligatorios', () => {

  it('lanza BadRequestException cuando el contexto no tiene carreraId', async () => {
    const { svc } = makeSvc([]);
    await expect(
      svc.evaluar(makeContexto({ carreraId: undefined })),
    ).rejects.toThrow(BadRequestException);
  });

  it('no consulta datos cuando carreraId está ausente', async () => {
    const { svc, consultas } = makeSvc([]);
    await expect(svc.evaluar(makeContexto({ carreraId: undefined }))).rejects.toThrow();
    expect(consultas.obtenerVinculacionesDeCarrera).not.toHaveBeenCalled();
  });

});

// ════════════════════════════════════════════════════════════════════════════
// B. ESTADO NO_APLICA — carrera sin plantel activo
// ════════════════════════════════════════════════════════════════════════════

describe('R06EvaluadorService — B. NO_APLICA', () => {

  it('sin vinculaciones → NO_APLICA, stats null, distribución vacía', async () => {
    const { svc } = makeSvc([]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(resultado.valor!.totalDocentes).toBe(0);
    expect(resultado.valor!.promedio).toBeNull();
    expect(resultado.valor!.mediana).toBeNull();
    expect(resultado.valor!.maximo).toBeNull();
    expect(resultado.valor!.distribucion).toEqual([]);
  });

  it('solo vinculaciones no APROBADAS → NO_APLICA', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01', { estado: 'PENDIENTE_DE_APROBACION' }),
      makeVin('doc-02', 'mat-01', { estado: 'RECHAZADA' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(resultado.valor!.totalDocentes).toBe(0);
  });

  it('resultado contiene carreraId del contexto', async () => {
    const { svc } = makeSvc([]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.carreraId).toBe(CAR_ID);
    expect(resultado.contextoId).toBe(CAR_ID);
    expect(resultado.tipoContexto).toBe('CARRERA');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// C. CASO ÚNICO — un docente, una materia
// ════════════════════════════════════════════════════════════════════════════

describe('R06EvaluadorService — C. caso único', () => {

  it('un docente con una materia → stats todos iguales a 1', async () => {
    const { svc } = makeSvc([makeVin('doc-01', 'mat-01')]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(resultado.valor!.totalDocentes).toBe(1);
    expect(resultado.valor!.promedio).toBe(1);
    expect(resultado.valor!.mediana).toBe(1);
    expect(resultado.valor!.maximo).toBe(1);
  });

  it('distribución contiene docenteId y nombre completo', async () => {
    const { svc } = makeSvc([makeVin('doc-01', 'mat-01')]);
    const resultado = await svc.evaluar(makeContexto());
    const [entry] = resultado.valor!.distribucion;
    expect(entry.docenteId).toBe('doc-01');
    expect(entry.nombre).toContain('doc-01');
    expect(entry.nMaterias).toBe(1);
  });

  it('datosFaltantes vacío cuando hay vinculaciones APROBADAS', async () => {
    const { svc } = makeSvc([makeVin('doc-01', 'mat-01')]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.datosFaltantes).toEqual([]);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// D. DISTRIBUCIÓN MÚLTIPLE — promedio, mediana, máximo
// ════════════════════════════════════════════════════════════════════════════

describe('R06EvaluadorService — D. estadísticas con múltiples docentes', () => {

  it('tres docentes con 1, 2 y 3 materias → promedio=2, mediana=2, máximo=3', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-02', 'mat-01'),
      makeVin('doc-02', 'mat-02'),
      makeVin('doc-03', 'mat-01'),
      makeVin('doc-03', 'mat-02'),
      makeVin('doc-03', 'mat-03'),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.totalDocentes).toBe(3);
    expect(resultado.valor!.promedio).toBe(2);
    expect(resultado.valor!.mediana).toBe(2);
    expect(resultado.valor!.maximo).toBe(3);
  });

  it('dos docentes con 1 y 3 materias → mediana = 2 (promedio de ambos)', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-02', 'mat-01'),
      makeVin('doc-02', 'mat-02'),
      makeVin('doc-02', 'mat-03'),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.totalDocentes).toBe(2);
    expect(resultado.valor!.mediana).toBe(2);      // (1+3)/2
    expect(resultado.valor!.maximo).toBe(3);
  });

  it('cuatro docentes [1,2,3,4] → mediana = 2.5', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-02', 'mat-01'),
      makeVin('doc-02', 'mat-02'),
      makeVin('doc-03', 'mat-01'),
      makeVin('doc-03', 'mat-02'),
      makeVin('doc-03', 'mat-03'),
      makeVin('doc-04', 'mat-01'),
      makeVin('doc-04', 'mat-02'),
      makeVin('doc-04', 'mat-03'),
      makeVin('doc-04', 'mat-04'),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.mediana).toBe(2.5);
    expect(resultado.valor!.maximo).toBe(4);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// E. DEDUPLICACIÓN — misma materia en distintas cátedras
// ════════════════════════════════════════════════════════════════════════════

describe('R06EvaluadorService — E. deduplicación por materiaId', () => {

  it('misma materia en dos cátedras distintas para el mismo docente → 1 materia', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01', { catedraId: 'cat-A' }),
      makeVin('doc-01', 'mat-01', { catedraId: 'cat-B' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.totalDocentes).toBe(1);
    expect(resultado.valor!.distribucion[0].nMaterias).toBe(1);
  });

  it('ejemplo del spec: Materia1-CátedraA + Materia1-CátedraB + Materia2 → 2 materias', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01', { catedraId: 'cat-A' }),
      makeVin('doc-01', 'mat-01', { catedraId: 'cat-B' }),
      makeVin('doc-01', 'mat-02', { catedraId: 'cat-A' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nMaterias).toBe(2);
  });

  it('mismo docenteId en dos planes distintos con misma materia → 1 materia (cross-plan dedup)', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01', { planEstudioId: 'plan-A' }),
      makeVin('doc-01', 'mat-01', { planEstudioId: 'plan-B' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nMaterias).toBe(1);
  });

  it('mismo docenteId con materias distintas en dos planes → suma correctamente', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01', { planEstudioId: 'plan-A' }),
      makeVin('doc-01', 'mat-02', { planEstudioId: 'plan-B' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nMaterias).toBe(2);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// F. SOLO VINCULACIONES APROBADAS
// ════════════════════════════════════════════════════════════════════════════

describe('R06EvaluadorService — F. filtro por estado APROBADA', () => {

  it('vinculación PENDIENTE_DE_APROBACION no cuenta', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-01', 'mat-02', { estado: 'PENDIENTE_DE_APROBACION' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nMaterias).toBe(1);
  });

  it('vinculación RECHAZADA no cuenta', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-01', 'mat-02', { estado: 'RECHAZADA' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nMaterias).toBe(1);
  });

  it('vinculación DESVINCULADA no cuenta', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-01', 'mat-02', { estado: 'DESVINCULADA' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nMaterias).toBe(1);
  });

  it('docente con solo vinculación PENDIENTE → no aparece en distribución', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-02', 'mat-01', { estado: 'PENDIENTE_DE_APROBACION' }),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.totalDocentes).toBe(1);
    expect(resultado.valor!.distribucion.map(d => d.docenteId)).not.toContain('doc-02');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// G. ORDENAMIENTO DE DISTRIBUCIÓN
// ════════════════════════════════════════════════════════════════════════════

describe('R06EvaluadorService — G. ordenamiento', () => {

  it('distribución ordenada por nMaterias DESC', async () => {
    const { svc } = makeSvc([
      makeVin('doc-01', 'mat-01'),
      makeVin('doc-02', 'mat-01'),
      makeVin('doc-02', 'mat-02'),
      makeVin('doc-02', 'mat-03'),
    ]);
    const resultado = await svc.evaluar(makeContexto());
    const nMats = resultado.valor!.distribucion.map(d => d.nMaterias);
    expect(nMats[0]).toBeGreaterThanOrEqual(nMats[1]);
  });

  it('desempate por nMaterias iguales: nombre ASC', async () => {
    const { svc } = makeSvc([
      { ...makeVin('doc-B', 'mat-01'), docente: { id: 'doc-B', nombre: 'Zeta', apellido: 'García', activo: true, dedicacion: null, categoriaDocente: null } },
      { ...makeVin('doc-A', 'mat-01'), docente: { id: 'doc-A', nombre: 'Abel', apellido: 'López', activo: true, dedicacion: null, categoriaDocente: null } },
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nombre).toContain('Abel');
    expect(resultado.valor!.distribucion[1].nombre).toContain('Zeta');
  });

  it('nombre completo = docente.nombre + " " + docente.apellido', async () => {
    const { svc } = makeSvc([
      {
        ...makeVin('doc-01', 'mat-01'),
        docente: { id: 'doc-01', nombre: 'María', apellido: 'Rodríguez', activo: true, dedicacion: null, categoriaDocente: null },
      },
    ]);
    const resultado = await svc.evaluar(makeContexto());
    expect(resultado.valor!.distribucion[0].nombre).toBe('María Rodríguez');
  });

});
