import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import { RegistroIndicadores } from './indicadores.registry';
import { IndicadoresService } from './indicadores.service';
import { R02EvaluadorService } from './r02.evaluador';
import { R06EvaluadorService } from './r06.evaluador';
import { R07EvaluadorService } from './r07.evaluador';
import { R08EvaluadorService } from './r08.evaluador';
import { R09EvaluadorService } from './r09.evaluador';
import { R12EvaluadorService } from './r12.evaluador';
import type {
  AlcanceIndicador,
  ContextoEvaluacion,
  DatoFaltante,
  IndicadorEvaluador,
  ResultadoIndicador,
} from './indicadores.types';
import { resultadoNoImplementado } from './indicadores.types';

// ── Constantes ───────────────────────────────────────────────────────────────

const USR    = 'usr-01';
const CAR_ID  = 'car-01';
const PLAN_ID = 'plan-01';
const FAC_ID  = 'fac-01';

const ADMIN   = 'ADMINISTRADOR_SISTEMA';
const SECRETA = 'SECRETARIA_ACADEMICA';
const RECTO   = 'RECTORADO';
const DECANO  = 'DECANO';
const DIRECTOR = 'DIRECTOR_CARRERA';
const DOCENTE  = 'DOCENTE';
const ADMVO    = 'ADMINISTRATIVO';

const FECHA = new Date('2026-10-13');

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

function makeScope({ tieneScope = true } = {}) {
  return {
    tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope),
    getCarrerasEnScope: jest.fn().mockResolvedValue(null),
  };
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    planEstudio: {
      findUnique: jest.fn().mockResolvedValue({ carreraId: CAR_ID }),
    },
    ...overrides,
  };
}

function makeR02Stub(consultas?: any): R02EvaluadorService {
  const c = consultas ?? {
    obtenerMateriasDePlan: jest.fn().mockResolvedValue([]),
    obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
  };
  return new R02EvaluadorService(c as any);
}

function makeR09Stub(): R09EvaluadorService {
  return new R09EvaluadorService(
    { obtenerMateriasDePlan: jest.fn().mockResolvedValue([]) } as any,
    {
      obtenerUmbrales: jest.fn().mockResolvedValue({
        planEstudioId: PLAN_ID,
        horasMinTotales: null, horasMinCB: null, horasMinTB: null,
        horasMinTA: null, horasMinCTX: null,
      }),
    } as any,
  );
}

function makeR08Stub(consultas?: any): R08EvaluadorService {
  const c = consultas ?? {
    obtenerMateriasDePlan: jest.fn().mockResolvedValue([]),
    obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
  };
  return new R08EvaluadorService(c as any);
}

function makeR06Stub(): R06EvaluadorService {
  return new R06EvaluadorService(
    { obtenerVinculacionesDeCarrera: jest.fn().mockResolvedValue([]) } as any,
  );
}

function makeR07Stub(): R07EvaluadorService {
  return new R07EvaluadorService(
    {
      obtenerVinculacionesParaR07: jest.fn().mockResolvedValue({ vinculaciones: [], facultadId: 'fac-test', alcanceFacultad: true, docentesMultiFacultad: new Set() }),
      obtenerConfigDeCarrera: jest.fn().mockResolvedValue(null),
    } as any,
  );
}

function makeR12Stub(): R12EvaluadorService {
  return new R12EvaluadorService(
    {
      obtenerDocentesParaR12: jest.fn().mockResolvedValue({ docentes: [], facultadId: 'fac-test', alcanceFacultad: true, docentesMultiFacultad: new Set() }),
    } as any,
  );
}

function makeSvc(
  scope: any,
  prisma: any,
  registro: RegistroIndicadores,
  r02?: R02EvaluadorService,
  r08?: R08EvaluadorService,
  r09?: R09EvaluadorService,
  r06?: R06EvaluadorService,
  r07?: R07EvaluadorService,
  r12?: R12EvaluadorService,
) {
  return new IndicadoresService(
    scope as any,
    registro,
    prisma as any,
    r02 ?? makeR02Stub(),
    r08 ?? makeR08Stub(),
    r09 ?? makeR09Stub(),
    r06 ?? makeR06Stub(),
    r07 ?? makeR07Stub(),
    r12 ?? makeR12Stub(),
  );
}

// ════════════════════════════════════════════════════════════════════════════
// A. REGISTRO
// ════════════════════════════════════════════════════════════════════════════

describe('RegistroIndicadores', () => {
  let registro: RegistroIndicadores;

  beforeEach(() => {
    registro = new RegistroIndicadores();
  });

  it('devuelve un indicador existente por código (R-09)', () => {
    const def = registro.obtener('R-09');
    expect(def).toBeDefined();
    expect(def!.codigo).toBe('R-09');
    expect(def!.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    expect(def!.alcance).toBe('PLAN');
  });

  it('devuelve undefined para un código inexistente', () => {
    expect(registro.obtener('R-INEXISTENTE')).toBeUndefined();
  });

  it('no contiene códigos duplicados — cada código es único', () => {
    const lista = registro.listar();
    const codigos = lista.map(d => d.codigo);
    const unicos = new Set(codigos);
    expect(unicos.size).toBe(codigos.length);
  });

  it('lanza Error al intentar registrar un código duplicado manualmente', () => {
    expect(() => {
      (registro as any).registrar({
        codigo: 'R-09',
        nombre: 'Duplicado',
        descripcion: 'test',
        tipo: 'ALERTA',
        severidad: 'ALTA',
        alcance: 'PLAN' as AlcanceIndicador,
        estadoImplementacion: 'NO_IMPLEMENTADO',
      });
    }).toThrow(/duplicado|R-09/i);
  });

  it('lista todos los indicadores definidos (R-02..R-12 sin R-01 ni R-05)', () => {
    const lista = registro.listar();
    const codigos = lista.map(d => d.codigo);
    // Indicadores que deben existir
    expect(codigos).toContain('R-02');
    expect(codigos).toContain('R-03');
    expect(codigos).toContain('R-04');
    expect(codigos).toContain('R-06');
    expect(codigos).toContain('R-07');
    expect(codigos).toContain('R-08');
    expect(codigos).toContain('R-09');
    expect(codigos).toContain('R-10');
    expect(codigos).toContain('R-11');
    expect(codigos).toContain('R-12');
    // Indicadores eliminados en MOD-DOC v8.1
    expect(codigos).not.toContain('R-01');
    expect(codigos).not.toContain('R-05');
  });

  it('el registro inicial tiene todos los indicadores en NO_IMPLEMENTADO (antes de asignar evaluadores)', () => {
    // RegistroIndicadores sin IndicadoresService: ningún evaluador ha sido cableado todavía.
    const lista = registro.listar();
    expect(lista.every(d => d.estadoImplementacion === 'NO_IMPLEMENTADO')).toBe(true);
  });

  it('tieneEvaluador devuelve false cuando no hay evaluador asignado', () => {
    expect(registro.tieneEvaluador('R-09')).toBe(false);
    expect(registro.tieneEvaluador('R-02')).toBe(false);
  });

  it('asignarEvaluador actualiza estado a IMPLEMENTADO y registra el evaluador', () => {
    const mockEvaluador: IndicadorEvaluador<number> = { evaluar: jest.fn() };
    registro.asignarEvaluador('R-09', mockEvaluador);
    expect(registro.tieneEvaluador('R-09')).toBe(true);
    const def = registro.obtener('R-09')!;
    expect(def.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(def.motivoPendiente).toBeUndefined();
  });

  it('asignarEvaluador lanza Error para código inexistente', () => {
    expect(() => {
      registro.asignarEvaluador('R-INEXISTENTE', { evaluar: jest.fn() });
    }).toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. CONTRATOS
// ════════════════════════════════════════════════════════════════════════════

describe('Contratos de ResultadoIndicador', () => {

  it('resultado numérico válido: IMPLEMENTADO + CALCULADO + valor numérico', () => {
    const resultado: ResultadoIndicador<number> = {
      codigo: 'R-09',
      contextoId: PLAN_ID,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: 2400,
      unidad: 'horas',
      datosFaltantes: [],
      fechaEvaluacion: FECHA,
    };
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(typeof resultado.valor).toBe('number');
    expect(resultado.unidad).toBe('horas');
    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('resultado booleano válido: IMPLEMENTADO + CALCULADO + valor boolean', () => {
    const resultado: ResultadoIndicador<boolean> = {
      codigo: 'R-02',
      contextoId: 'mat-01',
      tipoContexto: 'MATERIA',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: true,
      datosFaltantes: [],
      fechaEvaluacion: FECHA,
    };
    expect(resultado.valor).toBe(true);
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
  });

  it('resultado con datos faltantes: IMPLEMENTADO + PARCIAL + datosFaltantes no vacío', () => {
    const faltante: DatoFaltante = {
      campo: 'tiempoGestionAcademica',
      entidad: 'Docente',
      descripcion: 'Campo String? no parseable como número (R-03a)',
    };
    const resultado: ResultadoIndicador<number> = {
      codigo: 'R-03',
      contextoId: 'doc-01',
      tipoContexto: 'DOCENTE',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.PARCIAL,
      valor: 45,
      datosFaltantes: [faltante],
      fechaEvaluacion: FECHA,
    };
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(resultado.datosFaltantes).toHaveLength(1);
    expect(resultado.datosFaltantes[0].campo).toBe('tiempoGestionAcademica');
  });

  it('regla no implementada: NO_IMPLEMENTADO + estadoCalculo null + valor null', () => {
    const resultado = resultadoNoImplementado('R-09', PLAN_ID, 'PLAN', FECHA);
    expect(resultado.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBeNull();
    expect(resultado.valor).toBeNull();
    expect(resultado.datosFaltantes).toHaveLength(0);
  });

  it('estadoImplementacion y estadoCalculo son campos independientes', () => {
    // IMPLEMENTADO + NO_DETERMINABLE (regla existe, pero datos insuficientes)
    const conDatosInsuficientes: ResultadoIndicador<number> = {
      codigo: 'R-03',
      contextoId: 'doc-01',
      tipoContexto: 'DOCENTE',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      valor: null,
      datosFaltantes: [],
      fechaEvaluacion: FECHA,
    };
    expect(conDatosInsuficientes.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(conDatosInsuficientes.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    expect(conDatosInsuficientes.valor).toBeNull();

    // NO_IMPLEMENTADO → estadoCalculo siempre null
    const noImpl = resultadoNoImplementado('R-09', PLAN_ID, 'PLAN', FECHA);
    expect(noImpl.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    expect(noImpl.estadoCalculo).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C. AUTORIZACIÓN
// ════════════════════════════════════════════════════════════════════════════

describe('IndicadoresService — autorización y scope', () => {

  it.each([ADMIN, SECRETA, RECTO])(
    'rol global %s puede evaluar sin restricción territorial',
    async (rol) => {
      const reg = new RegistroIndicadores();
      const resultado = await makeSvc(makeScope(), makePrisma(), reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto({ rolNombre: rol }),
      });
      expect(resultado.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    },
  );

  it('DECANO dentro de su facultad (scope válido) → autorizado', async () => {
    const reg = new RegistroIndicadores();
    const scope = makeScope({ tieneScope: true });
    const resultado = await makeSvc(scope, makePrisma(), reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto({ rolNombre: DECANO, carreraId: CAR_ID }),
    });
    expect(resultado.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(USR, DECANO, CAR_ID);
  });

  it('DECANO fuera de su facultad → ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const scope = makeScope({ tieneScope: false });
    await expect(
      makeSvc(scope, makePrisma(), reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto({ rolNombre: DECANO, carreraId: 'car-ajena' }),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('DIRECTOR_CARRERA con carrera autorizada → autorizado', async () => {
    const reg = new RegistroIndicadores();
    const scope = makeScope({ tieneScope: true });
    const resultado = await makeSvc(scope, makePrisma(), reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto({ rolNombre: DIRECTOR, carreraId: CAR_ID }),
    });
    expect(resultado.estadoImplementacion).toBe('NO_IMPLEMENTADO');
  });

  it('DIRECTOR_CARRERA fuera de su carrera → ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const scope = makeScope({ tieneScope: false });
    await expect(
      makeSvc(scope, makePrisma(), reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto({ rolNombre: DIRECTOR, carreraId: 'car-ajena' }),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('DOCENTE → ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    await expect(
      makeSvc(makeScope(), makePrisma(), reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto({ rolNombre: DOCENTE }),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ADMINISTRATIVO → ForbiddenException (excluido de MOD-AUT aunque sea global en ScopeService)', async () => {
    const reg = new RegistroIndicadores();
    await expect(
      makeSvc(makeScope(), makePrisma(), reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto({ rolNombre: ADMVO }),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('IDOR: planEstudioId ajeno con scope inválido → ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const scope = makeScope({ tieneScope: false });
    const prisma = makePrisma({
      planEstudio: { findUnique: jest.fn().mockResolvedValue({ carreraId: 'car-ajena' }) },
    });
    await expect(
      makeSvc(scope, prisma, reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto({ rolNombre: DIRECTOR, carreraId: undefined, planEstudioId: 'plan-ajeno' }),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('DECANO/DIRECTOR sin carreraId ni planEstudioId → ForbiddenException (sin contexto territorial)', async () => {
    const reg = new RegistroIndicadores();
    await expect(
      makeSvc(makeScope(), makePrisma(), reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto({ rolNombre: DECANO, carreraId: undefined, planEstudioId: undefined }),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('planEstudioId válido resuelve carreraId y verifica scope', async () => {
    const reg = new RegistroIndicadores();
    const scope = makeScope({ tieneScope: true });
    const prisma = makePrisma({
      planEstudio: { findUnique: jest.fn().mockResolvedValue({ carreraId: CAR_ID }) },
    });
    const resultado = await makeSvc(scope, prisma, reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto({ rolNombre: DIRECTOR, carreraId: undefined, planEstudioId: PLAN_ID }),
    });
    expect(prisma.planEstudio.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PLAN_ID } }),
    );
    expect(scope.tieneScopeCarrera).toHaveBeenCalledWith(USR, DIRECTOR, CAR_ID);
    expect(resultado.estadoImplementacion).toBe('NO_IMPLEMENTADO');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// D. ORQUESTACIÓN
// ════════════════════════════════════════════════════════════════════════════

describe('IndicadoresService — orquestación', () => {

  it('indicador registrado → resultado identificado con código correcto', async () => {
    const reg = new RegistroIndicadores();
    const resultado = await makeSvc(makeScope(), makePrisma(), reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto(),
    });
    expect(resultado.codigo).toBe('R-11');
    expect(resultado.tipoContexto).toBe('PLAN');
    expect(resultado.estadoImplementacion).toBe('NO_IMPLEMENTADO');
  });

  it('indicador inexistente → NotFoundException', async () => {
    const reg = new RegistroIndicadores();
    await expect(
      makeSvc(makeScope(), makePrisma(), reg).evaluar({
        codigoIndicador: 'R-INEXISTENTE',
        contexto: makeContexto(),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('indicador sin implementación → NO_IMPLEMENTADO + estadoCalculo null + valor null', async () => {
    const reg = new RegistroIndicadores();
    const resultado = await makeSvc(makeScope(), makePrisma(), reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto({ carreraId: CAR_ID }),
    });
    expect(resultado.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBeNull();
    expect(resultado.valor).toBeNull();
  });

  it('no se ejecuta ningún evaluador cuando el indicador es NO_IMPLEMENTADO', async () => {
    const reg = new RegistroIndicadores();
    // Evaluador creado pero NO asignado al registro
    const mockEvaluador: IndicadorEvaluador<number> = { evaluar: jest.fn() };
    await makeSvc(makeScope(), makePrisma(), reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto(),
    });
    expect(mockEvaluador.evaluar).not.toHaveBeenCalled();
  });

  it('no se consulta planEstudio cuando carreraId está disponible directamente', async () => {
    const reg = new RegistroIndicadores();
    const prisma = makePrisma();
    // DIRECTOR con carreraId directa — no debe buscar el plan
    await makeSvc(makeScope({ tieneScope: true }), prisma, reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto({ rolNombre: DIRECTOR, carreraId: CAR_ID }),
    });
    expect(prisma.planEstudio.findUnique).not.toHaveBeenCalled();
  });

  it('se delega al evaluador cuando está asignado en el registro', async () => {
    const reg = new RegistroIndicadores();
    const respuestaEsperada: ResultadoIndicador<number> = {
      codigo: 'R-11',
      contextoId: PLAN_ID,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'IMPLEMENTADO',
      estadoCalculo: EstadoCalculo.CALCULADO,
      valor: 2400,
      datosFaltantes: [],
      fechaEvaluacion: FECHA,
    };
    const mockEvaluador: IndicadorEvaluador<number> = {
      evaluar: jest.fn().mockResolvedValue(respuestaEsperada),
    };
    reg.asignarEvaluador('R-11', mockEvaluador);

    const resultado = await makeSvc(makeScope(), makePrisma(), reg).evaluar({
      codigoIndicador: 'R-11',
      contexto: makeContexto(),
    });
    expect(mockEvaluador.evaluar).toHaveBeenCalledTimes(1);
    expect(resultado.valor).toBe(2400);
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('errores del evaluador se propagan sin modificación', async () => {
    const reg = new RegistroIndicadores();
    const mockEvaluador: IndicadorEvaluador<unknown> = {
      evaluar: jest.fn().mockRejectedValue(new Error('Fallo de evaluación')),
    };
    reg.asignarEvaluador('R-11', mockEvaluador);
    await expect(
      makeSvc(makeScope(), makePrisma(), reg).evaluar({
        codigoIndicador: 'R-11',
        contexto: makeContexto(),
      }),
    ).rejects.toThrow('Fallo de evaluación');
  });

  it('datos faltantes se preservan tal como los devuelve el evaluador', async () => {
    const reg = new RegistroIndicadores();
    const faltantes: DatoFaltante[] = [
      { campo: 'tiempoGestionAcademica', entidad: 'Docente', descripcion: 'String? no parseable' },
    ];
    const mockEvaluador: IndicadorEvaluador<number> = {
      evaluar: jest.fn().mockResolvedValue({
        codigo: 'R-03',
        contextoId: 'doc-01',
        tipoContexto: 'DOCENTE' as AlcanceIndicador,
        estadoImplementacion: 'IMPLEMENTADO',
        estadoCalculo: EstadoCalculo.PARCIAL,
        valor: 55,
        datosFaltantes: faltantes,
        fechaEvaluacion: FECHA,
      } as ResultadoIndicador<number>),
    };
    reg.asignarEvaluador('R-03', mockEvaluador);
    const resultado = await makeSvc(makeScope(), makePrisma(), reg).evaluar({
      codigoIndicador: 'R-03',
      contexto: makeContexto(),
    });
    expect(resultado.datosFaltantes).toEqual(faltantes);
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(resultado.valor).toBe(55);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// E. R-08 INTEGRACIÓN CON IndicadoresService
// ════════════════════════════════════════════════════════════════════════════

describe('IndicadoresService — R-08 integración', () => {

  it('R-08 está marcado IMPLEMENTADO en el registro después de inicializar el servicio', () => {
    const reg = new RegistroIndicadores();
    // Antes del cableado: NO_IMPLEMENTADO
    expect(reg.obtener('R-08')!.estadoImplementacion).toBe('NO_IMPLEMENTADO');

    makeSvc(makeScope(), makePrisma(), reg);

    // Después del cableado: IMPLEMENTADO
    expect(reg.obtener('R-08')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.tieneEvaluador('R-08')).toBe(true);
  });

  it('evaluar R-08 con plan sin materias devuelve NO_APLICA (integración real con evaluador)', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn().mockResolvedValue([]),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    const r08Real = new R08EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, r08Real);

    const resultado = await svc.evaluar({
      codigoIndicador: 'R-08',
      contexto: makeContexto({ planEstudioId: PLAN_ID }),
    });

    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(resultado.codigo).toBe('R-08');
  });

  it('rol global puede evaluar R-08 sin restricción territorial', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn().mockResolvedValue([]),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    const r08Real = new R08EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, r08Real);

    const resultado = await svc.evaluar({
      codigoIndicador: 'R-08',
      contexto: makeContexto({ rolNombre: 'ADMINISTRADOR_SISTEMA', planEstudioId: PLAN_ID }),
    });
    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('DOCENTE rechazado también para R-08 — ForbiddenException antes de llegar al evaluador', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r08Real = new R08EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, r08Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-08',
        contexto: makeContexto({ rolNombre: 'DOCENTE' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('ADMINISTRATIVO rechazado también para R-08 — ForbiddenException antes de llegar al evaluador', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r08Real = new R08EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, r08Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-08',
        contexto: makeContexto({ rolNombre: 'ADMINISTRATIVO' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('DIRECTOR fuera de scope rechazado para R-08 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r08Real = new R08EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope({ tieneScope: false }), makePrisma(), reg, undefined, r08Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-08',
        contexto: makeContexto({ rolNombre: 'DIRECTOR_CARRERA', carreraId: 'car-ajena' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('sin planEstudioId → BadRequestException antes de consultar datos académicos', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r08Real = new R08EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, r08Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-08',
        contexto: makeContexto({ rolNombre: 'ADMINISTRADOR_SISTEMA', planEstudioId: undefined }),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('DECANO fuera de scope rechazado para R-08 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r08Real = new R08EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope({ tieneScope: false }), makePrisma(), reg, undefined, r08Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-08',
        contexto: makeContexto({ rolNombre: 'DECANO', carreraId: 'car-ajena', planEstudioId: PLAN_ID }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// F. R-02 INTEGRACIÓN CON IndicadoresService
// ════════════════════════════════════════════════════════════════════════════

describe('IndicadoresService — R-02 integración', () => {

  it('R-02 está marcado IMPLEMENTADO en el registro después de inicializar el servicio', () => {
    const reg = new RegistroIndicadores();
    expect(reg.obtener('R-02')!.estadoImplementacion).toBe('NO_IMPLEMENTADO');

    makeSvc(makeScope(), makePrisma(), reg);

    expect(reg.obtener('R-02')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.tieneEvaluador('R-02')).toBe(true);
  });

  it('R-08 sigue IMPLEMENTADO cuando se inicializa el servicio (regresión)', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    expect(reg.obtener('R-08')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.tieneEvaluador('R-08')).toBe(true);
  });

  it('indicadores no implementados siguen en NO_IMPLEMENTADO tras el cableado', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    const noImpl = reg.listar().filter(d => !['R-02', 'R-06', 'R-07', 'R-08', 'R-09', 'R-12'].includes(d.codigo));
    expect(noImpl.every(d => d.estadoImplementacion === 'NO_IMPLEMENTADO')).toBe(true);
  });

  it('evaluar R-02 con plan sin materias devuelve NO_APLICA (integración real con evaluador)', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn().mockResolvedValue([]),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    const r02Real = new R02EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, r02Real);

    const resultado = await svc.evaluar({
      codigoIndicador: 'R-02',
      contexto: makeContexto({ planEstudioId: PLAN_ID }),
    });

    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(resultado.codigo).toBe('R-02');
  });

  it('DOCENTE rechazado para R-02 — ForbiddenException antes de llegar al evaluador', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r02Real = new R02EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, r02Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-02',
        contexto: makeContexto({ rolNombre: 'DOCENTE' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('ADMINISTRATIVO rechazado para R-02 — ForbiddenException antes de llegar al evaluador', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r02Real = new R02EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, r02Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-02',
        contexto: makeContexto({ rolNombre: 'ADMINISTRATIVO' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('sin planEstudioId → BadRequestException antes de consultar datos académicos (R-02)', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r02Real = new R02EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, r02Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-02',
        contexto: makeContexto({ rolNombre: 'ADMINISTRADOR_SISTEMA', planEstudioId: undefined }),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('DIRECTOR fuera de scope rechazado para R-02 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn(),
      obtenerVinculacionesDePlan: jest.fn(),
    };
    const r02Real = new R02EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope({ tieneScope: false }), makePrisma(), reg, r02Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-02',
        contexto: makeContexto({ rolNombre: 'DIRECTOR_CARRERA', carreraId: 'car-ajena' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// G. R-09 INTEGRACIÓN CON IndicadoresService
// ════════════════════════════════════════════════════════════════════════════

describe('IndicadoresService — R-09 integración', () => {

  it('R-09 está marcado IMPLEMENTADO en el registro después de inicializar el servicio', () => {
    const reg = new RegistroIndicadores();
    expect(reg.obtener('R-09')!.estadoImplementacion).toBe('NO_IMPLEMENTADO');

    makeSvc(makeScope(), makePrisma(), reg);

    expect(reg.obtener('R-09')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.tieneEvaluador('R-09')).toBe(true);
  });

  it('R-02 y R-08 continúan IMPLEMENTADO (regresión)', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    expect(reg.obtener('R-02')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.obtener('R-08')!.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('indicadores distintos de R-02, R-06, R-07, R-08 y R-09 siguen en NO_IMPLEMENTADO', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    const noImpl = reg.listar().filter(d => !['R-02', 'R-06', 'R-07', 'R-08', 'R-09', 'R-12'].includes(d.codigo));
    expect(noImpl.every(d => d.estadoImplementacion === 'NO_IMPLEMENTADO')).toBe(true);
  });

  it('evaluar R-09 con plan sin materias devuelve NO_APLICA (integración real)', async () => {
    const reg = new RegistroIndicadores();
    const consultas = {
      obtenerMateriasDePlan: jest.fn().mockResolvedValue([]),
      obtenerVinculacionesDePlan: jest.fn().mockResolvedValue([]),
    };
    const configPlanMock = {
      obtenerUmbrales: jest.fn().mockResolvedValue({
        planEstudioId: PLAN_ID,
        horasMinTotales: null, horasMinCB: null, horasMinTB: null,
        horasMinTA: null, horasMinCTX: null,
      }),
    };
    const r09Real = new R09EvaluadorService(consultas as any, configPlanMock as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, r09Real);

    const resultado = await svc.evaluar({
      codigoIndicador: 'R-09',
      contexto: makeContexto({ planEstudioId: PLAN_ID }),
    });

    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(resultado.codigo).toBe('R-09');
  });

  it('DOCENTE rechazado para R-09 — ForbiddenException antes de llegar al evaluador', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerMateriasDePlan: jest.fn(), obtenerVinculacionesDePlan: jest.fn() };
    const configPlanMock = { obtenerUmbrales: jest.fn() };
    const r09Real = new R09EvaluadorService(consultas as any, configPlanMock as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, r09Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-09',
        contexto: makeContexto({ rolNombre: 'DOCENTE' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
    expect(configPlanMock.obtenerUmbrales).not.toHaveBeenCalled();
  });

  it('ADMINISTRATIVO rechazado para R-09 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerMateriasDePlan: jest.fn(), obtenerVinculacionesDePlan: jest.fn() };
    const configPlanMock = { obtenerUmbrales: jest.fn() };
    const r09Real = new R09EvaluadorService(consultas as any, configPlanMock as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, r09Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-09',
        contexto: makeContexto({ rolNombre: 'ADMINISTRATIVO' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });

  it('sin planEstudioId → BadRequestException antes de consultar datos (R-09)', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerMateriasDePlan: jest.fn() };
    const configPlanMock = { obtenerUmbrales: jest.fn() };
    const r09Real = new R09EvaluadorService(consultas as any, configPlanMock as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, r09Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-09',
        contexto: makeContexto({ rolNombre: 'ADMINISTRADOR_SISTEMA', planEstudioId: undefined }),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
    expect(configPlanMock.obtenerUmbrales).not.toHaveBeenCalled();
  });

  it('DIRECTOR fuera de scope rechazado para R-09 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerMateriasDePlan: jest.fn() };
    const configPlanMock = { obtenerUmbrales: jest.fn() };
    const r09Real = new R09EvaluadorService(consultas as any, configPlanMock as any);
    const svc = makeSvc(makeScope({ tieneScope: false }), makePrisma(), reg, undefined, undefined, r09Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-09',
        contexto: makeContexto({ rolNombre: 'DIRECTOR_CARRERA', carreraId: 'car-ajena' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerMateriasDePlan).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// G. R-06 INTEGRACIÓN CON IndicadoresService
// ════════════════════════════════════════════════════════════════════════════

describe('IndicadoresService — R-06 integración', () => {

  it('R-06 está marcado IMPLEMENTADO en el registro después de inicializar el servicio', () => {
    const reg = new RegistroIndicadores();
    expect(reg.obtener('R-06')!.estadoImplementacion).toBe('NO_IMPLEMENTADO');

    makeSvc(makeScope(), makePrisma(), reg);

    expect(reg.obtener('R-06')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.tieneEvaluador('R-06')).toBe(true);
  });

  it('R-02, R-08 y R-09 continúan IMPLEMENTADO (regresión)', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    expect(reg.obtener('R-02')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.obtener('R-08')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.obtener('R-09')!.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('indicadores distintos de R-02, R-06, R-07, R-08 y R-09 siguen en NO_IMPLEMENTADO', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    const noImpl = reg.listar().filter(d => !['R-02', 'R-06', 'R-07', 'R-08', 'R-09', 'R-12'].includes(d.codigo));
    expect(noImpl.every(d => d.estadoImplementacion === 'NO_IMPLEMENTADO')).toBe(true);
  });

  it('evaluar R-06 con carrera sin vinculaciones APROBADAS devuelve NO_APLICA', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerVinculacionesDeCarrera: jest.fn().mockResolvedValue([]) };
    const r06Real = new R06EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, undefined, r06Real);

    const resultado = await svc.evaluar({
      codigoIndicador: 'R-06',
      contexto: makeContexto({ carreraId: CAR_ID }),
    });

    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(resultado.codigo).toBe('R-06');
  });

  it('DOCENTE rechazado para R-06 — ForbiddenException antes de llegar al evaluador', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerVinculacionesDeCarrera: jest.fn() };
    const r06Real = new R06EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, undefined, r06Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-06',
        contexto: makeContexto({ rolNombre: 'DOCENTE' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerVinculacionesDeCarrera).not.toHaveBeenCalled();
  });

  it('ADMINISTRATIVO rechazado para R-06 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerVinculacionesDeCarrera: jest.fn() };
    const r06Real = new R06EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, undefined, r06Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-06',
        contexto: makeContexto({ rolNombre: 'ADMINISTRATIVO' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerVinculacionesDeCarrera).not.toHaveBeenCalled();
  });

  it('DIRECTOR fuera de scope rechazado para R-06 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = { obtenerVinculacionesDeCarrera: jest.fn() };
    const r06Real = new R06EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope({ tieneScope: false }), makePrisma(), reg, undefined, undefined, undefined, r06Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-06',
        contexto: makeContexto({ rolNombre: 'DIRECTOR_CARRERA', carreraId: 'car-ajena' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerVinculacionesDeCarrera).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// H. R-07 INTEGRACIÓN CON IndicadoresService
// ════════════════════════════════════════════════════════════════════════════

describe('IndicadoresService — R-07 integración', () => {

  function makeConsultasR07(vinculaciones: any[] = [], config: any = null) {
    return {
      obtenerVinculacionesParaR07: jest.fn().mockResolvedValue({ vinculaciones, facultadId: FAC_ID, alcanceFacultad: true, docentesMultiFacultad: new Set() }),
      obtenerConfigDeCarrera: jest.fn().mockResolvedValue(config),
    };
  }

  it('R-07 está marcado IMPLEMENTADO en el registro después de inicializar el servicio', () => {
    const reg = new RegistroIndicadores();
    expect(reg.obtener('R-07')!.estadoImplementacion).toBe('NO_IMPLEMENTADO');

    makeSvc(makeScope(), makePrisma(), reg);

    expect(reg.obtener('R-07')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.tieneEvaluador('R-07')).toBe(true);
  });

  it('R-02, R-06, R-08 y R-09 continúan IMPLEMENTADO (regresión)', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    expect(reg.obtener('R-02')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.obtener('R-06')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.obtener('R-08')!.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(reg.obtener('R-09')!.estadoImplementacion).toBe('IMPLEMENTADO');
  });

  it('indicadores distintos de R-02, R-06, R-07, R-08 y R-09 siguen en NO_IMPLEMENTADO', () => {
    const reg = new RegistroIndicadores();
    makeSvc(makeScope(), makePrisma(), reg);
    const noImpl = reg.listar().filter(d => !['R-02', 'R-06', 'R-07', 'R-08', 'R-09', 'R-12'].includes(d.codigo));
    expect(noImpl.every(d => d.estadoImplementacion === 'NO_IMPLEMENTADO')).toBe(true);
  });

  it('evaluar R-07 con carrera sin vinculaciones APROBADAS devuelve NO_APLICA', async () => {
    const reg = new RegistroIndicadores();
    const consultas = makeConsultasR07([], { p03MaxMat: 3 });
    const r07Real = new R07EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, undefined, undefined, r07Real);

    const resultado = await svc.evaluar({
      codigoIndicador: 'R-07',
      contexto: makeContexto({ carreraId: CAR_ID }),
    });

    expect(resultado.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(resultado.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(resultado.codigo).toBe('R-07');
  });

  it('DOCENTE rechazado para R-07 — ForbiddenException antes de llegar al evaluador', async () => {
    const reg = new RegistroIndicadores();
    const consultas = makeConsultasR07();
    const r07Real = new R07EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, undefined, undefined, r07Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-07',
        contexto: makeContexto({ rolNombre: 'DOCENTE' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerVinculacionesParaR07).not.toHaveBeenCalled();
    expect(consultas.obtenerConfigDeCarrera).not.toHaveBeenCalled();
  });

  it('ADMINISTRATIVO rechazado para R-07 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = makeConsultasR07();
    const r07Real = new R07EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope(), makePrisma(), reg, undefined, undefined, undefined, undefined, r07Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-07',
        contexto: makeContexto({ rolNombre: 'ADMINISTRATIVO' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerVinculacionesParaR07).not.toHaveBeenCalled();
  });

  it('DIRECTOR fuera de scope rechazado para R-07 — ForbiddenException', async () => {
    const reg = new RegistroIndicadores();
    const consultas = makeConsultasR07();
    const r07Real = new R07EvaluadorService(consultas as any);
    const svc = makeSvc(makeScope({ tieneScope: false }), makePrisma(), reg, undefined, undefined, undefined, undefined, r07Real);

    await expect(
      svc.evaluar({
        codigoIndicador: 'R-07',
        contexto: makeContexto({ rolNombre: 'DIRECTOR_CARRERA', carreraId: 'car-ajena' }),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(consultas.obtenerVinculacionesParaR07).not.toHaveBeenCalled();
  });
});
