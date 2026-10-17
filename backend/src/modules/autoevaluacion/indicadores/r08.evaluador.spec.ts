import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { MateriaAut, VinculacionAut } from '../consultas-academicas/consultas-academicas.types';
import { RegistroIndicadores } from './indicadores.registry';
import { R08EvaluadorService } from './r08.evaluador';
import type { ContextoEvaluacion } from './indicadores.types';

// ── Constantes ────────────────────────────────────────────────────────────────

const USR     = 'usr-01';
const PLAN_ID = 'plan-01';
const CAR_ID  = 'car-01';
const FAC_ID  = 'fac-01';
const MAT_A   = 'mat-a';
const MAT_B   = 'mat-b';
const MAT_C   = 'mat-c';
const FECHA   = new Date('2026-10-13');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: USR,
    rolNombre: 'ADMINISTRADOR_SISTEMA',
    planEstudioId: PLAN_ID,
    carreraId: CAR_ID,
    fechaEvaluacion: FECHA,
    ...overrides,
  };
}

function makeMateria(id: string, nombre = `Materia ${id}`, codigo = `COD-${id}`): MateriaAut {
  return {
    id,
    codigo,
    nombre,
    planEstudioId: PLAN_ID,
    estado: 'ACTIVO',
    anio: 1,
    cuatrimestre: 1,
    bloqueConocimientoRaw: 'CB',
    bloqueNormalizado: 'CB',
    cargaHorariaSemanal: 4,
    cargaHorariaTotal: 64,
    tipoAsignatura: 'OBLIGATORIA',
  };
}

function makeVinc(
  materiaId: string,
  estado: string,
  esResponsableCatedra: boolean | null,
  id = `vin-${materiaId}-${String(esResponsableCatedra)}`,
): VinculacionAut {
  return {
    id,
    materiaId,
    docenteId: 'doc-01',
    catedraId: 'cat-01',
    planEstudioId: PLAN_ID,
    carreraId: CAR_ID,
    estado,
    esResponsableCatedra,
    horasSemana: 4,
    docente: {
      id: 'doc-01',
      nombre: 'Juan',
      apellido: 'García',
      activo: true,
      dedicacion: null,
      categoriaDocente: null,
    },
  };
}

function makeConsultas(
  materias: MateriaAut[],
  vinculaciones: VinculacionAut[],
) {
  return {
    obtenerMateriasDePlan: jest.fn().mockResolvedValue(materias),
    obtenerVinculacionesDePlan: jest.fn().mockResolvedValue(vinculaciones),
  };
}

function makeEvaluador(consultas: ReturnType<typeof makeConsultas>) {
  return new R08EvaluadorService(consultas as any);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. SIN planEstudioId — parámetro obligatorio
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — sin planEstudioId (parámetro obligatorio)', () => {

  it('lanza BadRequestException cuando no hay planEstudioId', async () => {
    const ev = makeEvaluador(makeConsultas([], []));
    await expect(ev.evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('mensaje de BadRequestException menciona planEstudioId', async () => {
    const ev = makeEvaluador(makeConsultas([], []));
    await expect(ev.evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(
      /planEstudioId/,
    );
  });

  it('no llama a ConsultasAcademicasService cuando no hay planEstudioId', async () => {
    const consultas = makeConsultas([], []);
    const ev = makeEvaluador(consultas);
    await expect(ev.evaluar(makeCtx({ planEstudioId: undefined }))).rejects.toThrow(
      BadRequestException,
    );
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
    expect(consultas.obtenerVinculacionesDePlan).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PLAN SIN MATERIAS
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — plan sin materias', () => {
  // Comportamiento documentado: NO_APLICA cuando un plan autorizado no contiene materias.
  // Justificación: no existe nada que evaluar — la ausencia de materias no es
  // una violación de la regla R-08. Pendiente de revisión si la especificación
  // funcional establece un criterio distinto para planes vacíos.

  it('devuelve NO_APLICA con valor vacío cuando el plan no tiene materias', async () => {
    const ev = makeEvaluador(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());

    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(res.valor).not.toBeNull();
    expect(res.valor!.totalMaterias).toBe(0);
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
    expect(res.valor!.materiasInciertas).toHaveLength(0);
    expect(res.valor!.totalConResponsable).toBe(0);
    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('contextoId = planEstudioId', async () => {
    const ev = makeEvaluador(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.contextoId).toBe(PLAN_ID);
    expect(res.tipoContexto).toBe('PLAN');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. CLASIFICACIÓN POR esResponsableCatedra
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — clasificación por esResponsableCatedra', () => {

  it('materia con APROBADA + esResponsableCatedra=true → totalConResponsable (sin alerta)', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'APROBADA', true)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.totalConResponsable).toBe(1);
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
    expect(res.valor!.materiasInciertas).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('materia con APROBADA + esResponsableCatedra=false → materiasConAlerta', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'APROBADA', false)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasConAlerta).toHaveLength(1);
    expect(res.valor!.materiasConAlerta[0].materiaId).toBe(MAT_A);
    expect(res.valor!.materiasConAlerta[0].tieneVinculacionesAprobadas).toBe(true);
    expect(res.valor!.materiasInciertas).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('materia con APROBADA + esResponsableCatedra=null → materiasInciertas + PARCIAL', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'APROBADA', null)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasInciertas).toHaveLength(1);
    expect(res.valor!.materiasInciertas[0].materiaId).toBe(MAT_A);
    expect(res.valor!.materiasInciertas[0].tieneVinculacionesAprobadas).toBe(true);
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('materia sin ninguna vinculación → materiasConAlerta con tieneVinculacionesAprobadas=false', async () => {
    const materias = [makeMateria(MAT_A)];
    const ev = makeEvaluador(makeConsultas(materias, []));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasConAlerta).toHaveLength(1);
    expect(res.valor!.materiasConAlerta[0].tieneVinculacionesAprobadas).toBe(false);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('materia sin vinculaciones APROBADAS (solo pendientes) → materiasConAlerta, tieneVinculacionesAprobadas=false', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'PENDIENTE_DE_APROBACION', null)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasConAlerta).toHaveLength(1);
    expect(res.valor!.materiasConAlerta[0].tieneVinculacionesAprobadas).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. ESTADOS DE VINCULACIÓN NO EFECTIVOS
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — vinculaciones no efectivas', () => {

  it('vinculación PENDIENTE con esResponsableCatedra=true no es responsable efectivo', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'PENDIENTE_DE_APROBACION', true)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasConAlerta).toHaveLength(1);
    expect(res.valor!.totalConResponsable).toBe(0);
  });

  it('vinculación DESVINCULADA con esResponsableCatedra=true no es responsable efectivo', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'DESVINCULADA', true)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasConAlerta).toHaveLength(1);
    expect(res.valor!.totalConResponsable).toBe(0);
  });

  it('vinculación RECHAZADA con esResponsableCatedra=true no es responsable efectivo', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'RECHAZADA', true)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasConAlerta).toHaveLength(1);
    expect(res.valor!.totalConResponsable).toBe(0);
  });

  it('APROBADA true + PENDIENTE true → solo la APROBADA cuenta → tiene responsable', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [
      makeVinc(MAT_A, 'APROBADA', true, 'v1'),
      makeVinc(MAT_A, 'PENDIENTE_DE_APROBACION', true, 'v2'),
    ];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.totalConResponsable).toBe(1);
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. LÓGICA DE PRECEDENCIA null vs false
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — precedencia null vs false vs true', () => {

  it('APROBADA null + APROBADA false (sin true) → incierto (null impide confirmar ausencia)', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [
      makeVinc(MAT_A, 'APROBADA', null, 'v1'),
      makeVinc(MAT_A, 'APROBADA', false, 'v2'),
    ];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.materiasInciertas).toHaveLength(1);
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('APROBADA true + APROBADA null → tiene responsable (true prevalece sobre null)', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [
      makeVinc(MAT_A, 'APROBADA', true, 'v1'),
      makeVinc(MAT_A, 'APROBADA', null, 'v2'),
    ];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.totalConResponsable).toBe(1);
    expect(res.valor!.materiasInciertas).toHaveLength(0);
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('esResponsableCatedra=null no se trata como false — no genera alerta confirmada', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'APROBADA', null)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    // La materia NO debe aparecer en materiasConAlerta (no está confirmada sin responsable)
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
    // Sí debe aparecer en inciertas
    expect(res.valor!.materiasInciertas).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. MÚLTIPLES MATERIAS — conteos y estadoCalculo
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — múltiples materias', () => {

  it('plan mixto: responsable + alerta + incierta → conteos y PARCIAL correctos', async () => {
    const materias = [makeMateria(MAT_A), makeMateria(MAT_B), makeMateria(MAT_C)];
    const vincs = [
      makeVinc(MAT_A, 'APROBADA', true),          // tiene responsable
      makeVinc(MAT_B, 'APROBADA', false),           // sin responsable confirmado
      makeVinc(MAT_C, 'APROBADA', null),            // incierto
    ];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.valor!.totalMaterias).toBe(3);
    expect(res.valor!.totalConResponsable).toBe(1);
    expect(res.valor!.materiasConAlerta).toHaveLength(1);
    expect(res.valor!.materiasConAlerta[0].materiaId).toBe(MAT_B);
    expect(res.valor!.materiasInciertas).toHaveLength(1);
    expect(res.valor!.materiasInciertas[0].materiaId).toBe(MAT_C);
    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
  });

  it('todas con responsable → CALCULADO + materiasConAlerta vacío', async () => {
    const materias = [makeMateria(MAT_A), makeMateria(MAT_B)];
    const vincs = [
      makeVinc(MAT_A, 'APROBADA', true, 'v1'),
      makeVinc(MAT_B, 'APROBADA', true, 'v2'),
    ];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor!.totalConResponsable).toBe(2);
    expect(res.valor!.materiasConAlerta).toHaveLength(0);
    expect(res.valor!.materiasInciertas).toHaveLength(0);
    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('sin incertidumbre → estadoCalculo CALCULADO', async () => {
    const materias = [makeMateria(MAT_A), makeMateria(MAT_B)];
    const vincs = [
      makeVinc(MAT_A, 'APROBADA', false),  // sin responsable pero clasificado
      makeVinc(MAT_B, 'APROBADA', false),  // ídem
    ];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor!.materiasConAlerta).toHaveLength(2);
    expect(res.valor!.materiasInciertas).toHaveLength(0);
  });

  it('la alerta incluye nombre y código de la materia', async () => {
    const materias = [makeMateria(MAT_A, 'Álgebra', 'MAT-101')];
    const vincs = [makeVinc(MAT_A, 'APROBADA', false)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    const alerta = res.valor!.materiasConAlerta[0];
    expect(alerta.nombre).toBe('Álgebra');
    expect(alerta.codigo).toBe('MAT-101');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. DATOS FALTANTES
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — datosFaltantes', () => {

  it('cuando hay incertidumbre → datosFaltantes incluye entrada con campo esResponsableCatedra', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'APROBADA', null)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.datosFaltantes).toHaveLength(1);
    expect(res.datosFaltantes[0].campo).toBe('esResponsableCatedra');
    expect(res.datosFaltantes[0].entidad).toBe('VinculacionCatedra');
    expect(res.datosFaltantes[0].descripcion).toMatch(/1 materia/);
  });

  it('sin incertidumbre → datosFaltantes vacío', async () => {
    const materias = [makeMateria(MAT_A)];
    const vincs = [makeVinc(MAT_A, 'APROBADA', true)];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('datosFaltantes indica el número de materias inciertas', async () => {
    const materias = [makeMateria(MAT_A), makeMateria(MAT_B)];
    const vincs = [
      makeVinc(MAT_A, 'APROBADA', null, 'v1'),
      makeVinc(MAT_B, 'APROBADA', null, 'v2'),
    ];
    const ev = makeEvaluador(makeConsultas(materias, vincs));
    const res = await ev.evaluar(makeCtx());

    expect(res.datosFaltantes[0].descripcion).toMatch(/2 materia/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. CONSISTENCIA DEL CONTRATO
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — contrato ResultadoIndicador', () => {

  it('estadoImplementacion = IMPLEMENTADO siempre', async () => {
    const ev = makeEvaluador(makeConsultas([makeMateria(MAT_A)], [makeVinc(MAT_A, 'APROBADA', true)]));
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('contextoId = planEstudioId cuando está presente', async () => {
    const ev = makeEvaluador(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx({ planEstudioId: 'plan-xyz' }));
    expect(res.contextoId).toBe('plan-xyz');
  });

  it('tipoContexto = PLAN', async () => {
    const ev = makeEvaluador(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.tipoContexto).toBe('PLAN');
  });

  it('código = R-08', async () => {
    const ev = makeEvaluador(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx());
    expect(res.codigo).toBe('R-08');
  });

  it('fechaEvaluacion se preserva desde el contexto', async () => {
    const fecha = new Date('2025-06-01');
    const ev = makeEvaluador(makeConsultas([], []));
    const res = await ev.evaluar(makeCtx({ fechaEvaluacion: fecha }));
    expect(res.fechaEvaluacion).toBe(fecha);
  });

  it('estadoCalculo nunca es null cuando estadoImplementacion = IMPLEMENTADO', async () => {
    const ev = makeEvaluador(makeConsultas([makeMateria(MAT_A)], [makeVinc(MAT_A, 'APROBADA', false)]));
    const res = await ev.evaluar(makeCtx());
    expect(res.estadoCalculo).not.toBeNull();
    expect(res.estadoImplementacion).toBe('IMPLEMENTADO');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. PROPAGACIÓN DE ERRORES (alcance institucional)
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — propagación de errores', () => {

  it('ForbiddenException de ConsultasAcademicasService se propaga (materia fuera de scope)', async () => {
    const consultas = {
      obtenerMateriasDePlan: jest.fn().mockRejectedValue(new ForbiddenException()),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    const ev = new R08EvaluadorService(consultas as any);
    await expect(ev.evaluar(makeCtx())).rejects.toThrow(ForbiddenException);
  });

  it('NotFoundException de ConsultasAcademicasService se propaga (plan no existe)', async () => {
    const consultas = {
      obtenerMateriasDePlan: jest.fn().mockRejectedValue(new NotFoundException('Plan no encontrado')),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    const ev = new R08EvaluadorService(consultas as any);
    await expect(ev.evaluar(makeCtx())).rejects.toThrow(NotFoundException);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. INTEGRACIÓN CON RegistroIndicadores
// ════════════════════════════════════════════════════════════════════════════

describe('R08EvaluadorService — integración con RegistroIndicadores', () => {

  it('R-08 puede asignarse al registro y queda marcado IMPLEMENTADO', () => {
    const registro = new RegistroIndicadores();
    const ev = new R08EvaluadorService(makeConsultas([], []) as any);
    registro.asignarEvaluador('R-08', ev);

    expect(registro.tieneEvaluador('R-08')).toBe(true);
    expect(registro.obtener('R-08')!.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('el evaluador asignado es el mismo que se instanció', () => {
    const registro = new RegistroIndicadores();
    const ev = new R08EvaluadorService(makeConsultas([], []) as any);
    registro.asignarEvaluador('R-08', ev);

    const def = registro.obtener('R-08')!;
    expect(def.evaluador).toBe(ev);
  });
});
