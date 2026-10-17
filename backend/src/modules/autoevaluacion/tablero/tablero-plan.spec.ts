import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AutoevaluacionController } from '../autoevaluacion.controller';
import { ConfigFacultadService } from '../config/config-facultad.service';
import { ConfigPlanService } from '../config/config-plan.service';
import { ResponsablesService } from '../responsables/responsables.service';
import { IndicadoresService } from '../indicadores/indicadores.service';
import { RegistroIndicadores } from '../indicadores/indicadores.registry';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { ResultadoIndicador } from '../indicadores/indicadores.types';
import type { ResultadoR08 } from '../indicadores/r08.evaluador';
import type { ResultadoR09 } from '../indicadores/r09.evaluador';
import { TablroPlanService } from './tablero-plan.service';

// ── Constantes ───────────────────────────────────────────────────────────────

const PLAN_ID = 'b2c3d4e5-f6a7-4901-bcde-f01234567891';
const FECHA   = new Date('2026-10-15T00:00:00.000Z');

const USR_ADMIN    = { id: 'u-admin', rol: { nombre: 'ADMINISTRADOR_SISTEMA' } };
const USR_SECRETA  = { id: 'u-sec',   rol: { nombre: 'SECRETARIA_ACADEMICA' } };
const USR_RECTO    = { id: 'u-rec',   rol: { nombre: 'RECTORADO' } };
const USR_DECANO   = { id: 'u-dec',   rol: { nombre: 'DECANO' } };
const USR_DIRECTOR = { id: 'u-dir',   rol: { nombre: 'DIRECTOR_CARRERA' } };
const USR_DOCENTE  = { id: 'u-doc',   rol: { nombre: 'DOCENTE' } };
const USR_ADMVO    = { id: 'u-adm',   rol: { nombre: 'ADMINISTRATIVO' } };

// ── Guard mock ─────────────────────────────────────────────────────────────

@Injectable()
class MockJwtGuard {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const header = req.headers['x-test-user'];
    if (!header) throw new UnauthorizedException();
    req.user = JSON.parse(header);
    return true;
  }
}

// ── Fixtures R-08 ─────────────────────────────────────────────────────────

function mkR08(partial: Partial<ResultadoR08> = {}, estado = EstadoCalculo.CALCULADO): ResultadoIndicador<ResultadoR08> {
  return {
    codigo: 'R-08',
    contextoId: PLAN_ID,
    tipoContexto: 'PLAN',
    estadoImplementacion: 'IMPLEMENTADO',
    estadoCalculo: estado,
    valor: {
      materiasConAlerta: [],
      materiasInciertas: [],
      totalMaterias: 0,
      totalConResponsable: 0,
      ...partial,
    },
    datosFaltantes: [],
    fechaEvaluacion: FECHA,
  };
}

// ── Fixtures R-09 ─────────────────────────────────────────────────────────

function mkR09(
  horasTotal: number | null,
  umbrales: { horasMinTotales?: number | null; CB?: number | null; TB?: number | null; TA?: number | null; CX?: number | null } = {},
  horas: { CB?: number | null; TB?: number | null; TA?: number | null; CX?: number | null } = {},
  estado = EstadoCalculo.CALCULADO,
): ResultadoIndicador<ResultadoR09> {
  const ht = horasTotal;
  const hMinT = umbrales.horasMinTotales ?? null;
  const mkDim = (hr: number | null, hmin: number | null) => ({
    horasReales: hr,
    horasMinimas: hmin,
    diferencia: hr !== null && hmin !== null ? hr - hmin : null,
    cumple: hr !== null && hmin !== null ? hr >= hmin : null,
  });
  return {
    codigo: 'R-09',
    contextoId: PLAN_ID,
    tipoContexto: 'PLAN',
    estadoImplementacion: 'IMPLEMENTADO',
    estadoCalculo: estado,
    valor: {
      planEstudioId: PLAN_ID,
      totalMaterias: 5,
      materiasSinHoras: [],
      materiasConBloqueIndeterminado: [],
      horasTotal: ht,
      horasPorBloque: {
        CB: horas.CB ?? null,
        TB: horas.TB ?? null,
        TA: horas.TA ?? null,
        CX: horas.CX ?? null,
      },
      evaluaciones: {
        total: mkDim(ht, hMinT),
        CB: mkDim(horas.CB ?? null, umbrales.CB ?? null),
        TB: mkDim(horas.TB ?? null, umbrales.TB ?? null),
        TA: mkDim(horas.TA ?? null, umbrales.TA ?? null),
        CX: mkDim(horas.CX ?? null, umbrales.CX ?? null),
      },
    },
    datosFaltantes: [],
    fechaEvaluacion: FECHA,
  };
}

// ── Factory HTTP ──────────────────────────────────────────────────────────

async function crearApp(consultarPlan: jest.Mock): Promise<INestApplication> {
  const rolesGuardInstance = {
    canActivate: (ctx: ExecutionContext) => {
      const reflector = new Reflector();
      const roles = reflector.getAllAndOverride<string[]>('roles', [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
      if (!roles) return true;
      const req = ctx.switchToHttp().getRequest<{ user?: { rol?: { nombre: string } } }>();
      return roles.includes(req.user?.rol?.nombre ?? '');
    },
  };

  const module = await Test.createTestingModule({
    controllers: [AutoevaluacionController],
    providers: [
      { provide: ConfigFacultadService, useValue: {} },
      { provide: ConfigPlanService,     useValue: {} },
      { provide: ResponsablesService,   useValue: {} },
      { provide: IndicadoresService,    useValue: { evaluar: jest.fn() } },
      { provide: RegistroIndicadores,   useValue: { listar: jest.fn().mockReturnValue([]) } },
      { provide: TablroPlanService,     useValue: { consultarPlan } },
    ],
  })
    .overrideGuard(JwtAuthGuard).useClass(MockJwtGuard)
    .overrideGuard(RolesGuard).useValue(rolesGuardInstance)
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return app;
}

// ════════════════════════════════════════════════════════════════════════════
// A. POST /autoevaluacion/tablero/plan/:planEstudioId — seguridad y estructura
// ════════════════════════════════════════════════════════════════════════════

describe('POST /autoevaluacion/tablero/plan/:planEstudioId', () => {
  let app: INestApplication;
  let consultarPlan: jest.Mock;

  const respuestaOk = {
    planEstudioId: PLAN_ID,
    fechaEvaluacion: FECHA.toISOString(),
    ipl01: { horasTotal: 2400, horasMinimas: 2000, diferencia: 400, cumple: true, estadoCalculo: 'CALCULADO' },
    ipl02: { bloquesCumplen: 4, bloquesConUmbral: 4, estadoCalculo: 'CALCULADO' },
    ipl03: { sinResponsable: 0, inciertas: 0, conResponsable: 5, totalMaterias: 5, estadoCalculo: 'CALCULADO' },
    ipl05: { bloques: [], estadoCalculo: 'CALCULADO' },
    estadoGeneralCalculo: 'CALCULADO',
    datosFaltantes: [],
    advertencias: [],
  };

  beforeEach(async () => {
    consultarPlan = jest.fn().mockResolvedValue(respuestaOk);
    app = await crearApp(consultarPlan);
  });

  afterEach(() => app.close());

  // ── Autenticación ────────────────────────────────────────────────────────

  it('sin token → 401', () => {
    return request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/plan/${PLAN_ID}`)
      .expect(401);
  });

  // ── Autorización por rol ─────────────────────────────────────────────────

  it.each([
    ['DOCENTE', USR_DOCENTE],
    ['ADMINISTRATIVO', USR_ADMVO],
  ])('rol %s → 403', (_rol, usuario) => {
    return request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/plan/${PLAN_ID}`)
      .set('x-test-user', JSON.stringify(usuario))
      .expect(403);
  });

  it.each([
    ['ADMINISTRADOR_SISTEMA', USR_ADMIN],
    ['SECRETARIA_ACADEMICA', USR_SECRETA],
    ['RECTORADO', USR_RECTO],
    ['DECANO', USR_DECANO],
    ['DIRECTOR_CARRERA', USR_DIRECTOR],
  ])('rol %s → 200', (_rol, usuario) => {
    return request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/plan/${PLAN_ID}`)
      .set('x-test-user', JSON.stringify(usuario))
      .expect(200);
  });

  // ── Validación del path param ────────────────────────────────────────────

  it('planEstudioId no es UUID v4 → 400', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/tablero/plan/no-es-uuid')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(400);
  });

  it('planEstudioId es UUID v1 (no v4) → 400', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/tablero/plan/550e8400-e29b-11d4-a716-446655440000')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(400);
  });

  // ── Errores de scope y plan inexistente ──────────────────────────────────

  it('plan inexistente → 404', async () => {
    consultarPlan.mockRejectedValue(new NotFoundException('Plan no encontrado'));
    const app2 = await crearApp(consultarPlan);
    await request(app2.getHttpServer())
      .post(`/autoevaluacion/tablero/plan/${PLAN_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(404);
    await app2.close();
  });

  it('usuario fuera de scope → 403', async () => {
    consultarPlan.mockRejectedValue(new ForbiddenException('Sin scope'));
    const app2 = await crearApp(consultarPlan);
    await request(app2.getHttpServer())
      .post(`/autoevaluacion/tablero/plan/${PLAN_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(403);
    await app2.close();
  });

  // ── Estructura de respuesta ──────────────────────────────────────────────

  it('respuesta 200 incluye todos los campos requeridos', async () => {
    const res = await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/plan/${PLAN_ID}`)
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    expect(res.body).toMatchObject({
      planEstudioId: PLAN_ID,
      ipl01: expect.objectContaining({ estadoCalculo: expect.any(String) }),
      ipl02: expect.objectContaining({ bloquesCumplen: expect.any(Number) }),
      ipl03: expect.objectContaining({ sinResponsable: expect.any(Number) }),
      ipl05: expect.objectContaining({ bloques: expect.any(Array) }),
      estadoGeneralCalculo: expect.any(String),
      datosFaltantes: expect.any(Array),
      advertencias: expect.any(Array),
    });
  });

  it('consultarPlan recibe planEstudioId, usuarioId y rolNombre del JWT', async () => {
    await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/plan/${PLAN_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(200);

    expect(consultarPlan).toHaveBeenCalledWith(
      PLAN_ID,
      USR_DIRECTOR.id,
      USR_DIRECTOR.rol.nombre,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. TablroPlanService — derivación de indicadores
// ════════════════════════════════════════════════════════════════════════════

describe('TablroPlanService', () => {
  let service: TablroPlanService;
  let mockIndicadores: { evaluar: jest.Mock };

  beforeEach(() => {
    mockIndicadores = { evaluar: jest.fn() };
    service = new TablroPlanService(mockIndicadores as unknown as IndicadoresService);
  });

  // ── Helpers de fixture ────────────────────────────────────────────────────

  function configEvaluar(r08: ResultadoIndicador<ResultadoR08>, r09: ResultadoIndicador<ResultadoR09>) {
    mockIndicadores.evaluar.mockImplementation((s: { codigoIndicador: string }) => {
      if (s.codigoIndicador === 'R-08') return Promise.resolve(r08);
      if (s.codigoIndicador === 'R-09') return Promise.resolve(r09);
      return Promise.reject(new Error(`Indicador inesperado: ${s.codigoIndicador}`));
    });
  }

  // ── IPL-01 — Horas totales vs P-10 ───────────────────────────────────────

  describe('IPL-01', () => {
    it('horas suficientes → cumple=true, diferencia≥0', async () => {
      configEvaluar(
        mkR08(),
        mkR09(2400, { horasMinTotales: 2000 }, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl01.cumple).toBe(true);
      expect(res.ipl01.diferencia).toBeGreaterThanOrEqual(0);
      expect(res.ipl01.horasTotal).toBe(2400);
      expect(res.ipl01.horasMinimas).toBe(2000);
      expect(res.ipl01.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('horas insuficientes → cumple=false, diferencia<0', async () => {
      configEvaluar(
        mkR08(),
        mkR09(1800, { horasMinTotales: 2000 }, { CB: 400, TB: 500, TA: 500, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl01.cumple).toBe(false);
      expect(res.ipl01.diferencia).toBeLessThan(0);
    });

    it('P-10 sin configurar → cumple=null, horasMinimas=null', async () => {
      configEvaluar(
        mkR08(),
        mkR09(2400, {}, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl01.cumple).toBeNull();
      expect(res.ipl01.horasMinimas).toBeNull();
      // horasTotal sigue siendo conocida
      expect(res.ipl01.horasTotal).toBe(2400);
    });

    it('horas incompletas (PARCIAL) → estadoCalculo=PARCIAL', async () => {
      configEvaluar(
        mkR08(),
        mkR09(null, { horasMinTotales: 2000 }, {}, EstadoCalculo.PARCIAL),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl01.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.advertencias.some(a => a.includes('IPL-01'))).toBe(true);
    });
  });

  // ── IPL-02 — Bloques que cumplen ─────────────────────────────────────────

  describe('IPL-02', () => {
    it('todos los bloques cumplen → bloquesCumplen=bloquesConUmbral', async () => {
      configEvaluar(
        mkR08(),
        mkR09(2400, { horasMinTotales: 2000, CB: 400, TB: 600, TA: 600, CX: 300 }, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl02.bloquesCumplen).toBe(4);
      expect(res.ipl02.bloquesConUmbral).toBe(4);
    });

    it('CB incumple → bloquesCumplen < bloquesConUmbral', async () => {
      configEvaluar(
        mkR08(),
        mkR09(2200, { horasMinTotales: 2000, CB: 700, TB: 600, TA: 600, CX: 300 }, { CB: 500, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl02.bloquesConUmbral).toBe(4);
      expect(res.ipl02.bloquesCumplen).toBe(3);
    });

    it('bloques sin umbral no se cuentan en denominador', async () => {
      // Solo CB y TB tienen umbral configurado
      configEvaluar(
        mkR08(),
        mkR09(2400, { horasMinTotales: 2000, CB: 400, TB: 600 }, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl02.bloquesConUmbral).toBe(2);
      expect(res.ipl02.bloquesCumplen).toBe(2);
    });

    it('ningún bloque con umbral → bloquesConUmbral=0, estadoCalculo=NO_APLICA', async () => {
      configEvaluar(
        mkR08(),
        mkR09(2400, {}, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl02.bloquesConUmbral).toBe(0);
      expect(res.ipl02.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.advertencias.some(a => a.includes('IPL-02'))).toBe(true);
    });
  });

  // ── IPL-03 — Materias sin responsable ───────────────────────────────────

  describe('IPL-03', () => {
    const materia = { materiaId: 'm1', nombre: 'Álgebra', codigo: 'ALG01', tieneVinculacionesAprobadas: false };
    const materiaIncierta = { materiaId: 'm2', nombre: 'Física', codigo: 'FIS01', tieneVinculacionesAprobadas: true };

    it('materia sin vinculación aprobada → sinResponsable++', async () => {
      configEvaluar(
        mkR08({ materiasConAlerta: [materia], totalMaterias: 1, totalConResponsable: 0 }),
        mkR09(2400),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl03.sinResponsable).toBe(1);
      expect(res.ipl03.conResponsable).toBe(0);
      expect(res.ipl03.inciertas).toBe(0);
    });

    it('materia con responsable confirmado → conResponsable++', async () => {
      configEvaluar(
        mkR08({ totalMaterias: 1, totalConResponsable: 1 }),
        mkR09(2400),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl03.conResponsable).toBe(1);
      expect(res.ipl03.sinResponsable).toBe(0);
    });

    it('materia con responsabilidad incierta → inciertas++', async () => {
      configEvaluar(
        mkR08({ materiasInciertas: [materiaIncierta], totalMaterias: 1, totalConResponsable: 0 }, EstadoCalculo.PARCIAL),
        mkR09(2400),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl03.inciertas).toBe(1);
      expect(res.ipl03.sinResponsable).toBe(0);
      expect(res.ipl03.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    });

    it('no hay doble conteo: sinResponsable + inciertas + conResponsable = totalMaterias', async () => {
      configEvaluar(
        mkR08({
          materiasConAlerta: [materia],
          materiasInciertas: [materiaIncierta],
          totalMaterias: 4,
          totalConResponsable: 2,
        }),
        mkR09(2400),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      const { sinResponsable, inciertas, conResponsable, totalMaterias } = res.ipl03;
      expect(sinResponsable + inciertas + conResponsable).toBe(totalMaterias);
    });
  });

  // ── IPL-05 — Horas por bloque ────────────────────────────────────────────

  describe('IPL-05', () => {
    it('devuelve los cinco bloques CB, TB, TA, CX y TOTAL', async () => {
      configEvaluar(
        mkR08(),
        mkR09(2400, { horasMinTotales: 2000, CB: 400, TB: 600, TA: 600, CX: 300 }, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      const bloques = res.ipl05.bloques.map(b => b.bloque);
      expect(bloques).toEqual(['CB', 'TB', 'TA', 'CX', 'TOTAL']);
    });

    it('bloque CX tiene bloque="CX" (corresponde a CTC del FSD)', async () => {
      configEvaluar(
        mkR08(),
        mkR09(2400, { CX: 300 }, { CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      const cx = res.ipl05.bloques.find(b => b.bloque === 'CX');
      expect(cx).toBeDefined();
      expect(cx!.horasReales).toBe(400);
      expect(cx!.horasMinimas).toBe(300);
      expect(cx!.cumple).toBe(true);
    });

    it('bloque sin umbral → estadoCalculo=NO_APLICA, cumple=null', async () => {
      // Solo TOTAL y CB tienen umbral; TB, TA, CX no
      configEvaluar(
        mkR08(),
        mkR09(2400, { horasMinTotales: 2000, CB: 400 }, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      const tb = res.ipl05.bloques.find(b => b.bloque === 'TB');
      expect(tb!.cumple).toBeNull();
      expect(tb!.horasMinimas).toBeNull();
      expect(tb!.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('datos parciales (PARCIAL) → estadoCalculo=PARCIAL en IPL-05', async () => {
      configEvaluar(
        mkR08(),
        mkR09(null, { CB: 400 }, {}, EstadoCalculo.PARCIAL),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl05.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
      expect(res.advertencias.some(a => a.includes('IPL-05'))).toBe(true);
    });
  });

  // ── Autorización ─────────────────────────────────────────────────────────

  describe('errores de autorización', () => {
    it('re-lanza ForbiddenException antes de derivar indicadores', async () => {
      mockIndicadores.evaluar.mockRejectedValue(new ForbiddenException('Sin scope'));
      await expect(
        service.consultarPlan(PLAN_ID, 'u-dir', 'DIRECTOR_CARRERA'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('re-lanza NotFoundException si el plan no existe', async () => {
      mockIndicadores.evaluar.mockRejectedValue(new NotFoundException('Plan no encontrado'));
      await expect(
        service.consultarPlan(PLAN_ID, 'u-dir', 'DIRECTOR_CARRERA'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no re-lanza errores no relacionados con autorización', async () => {
      // Un error interno (p.ej. base de datos) se absorbe y produce NO_DETERMINABLE
      mockIndicadores.evaluar.mockRejectedValue(new Error('DB connection lost'));
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.ipl01.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
      expect(res.ipl03.estadoCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });
  });

  // ── estadoGeneralCalculo ──────────────────────────────────────────────────

  describe('estadoGeneralCalculo', () => {
    it('todos CALCULADO → estadoGeneralCalculo=CALCULADO', async () => {
      configEvaluar(
        mkR08({ totalMaterias: 3, totalConResponsable: 3 }),
        mkR09(2400, { horasMinTotales: 2000, CB: 400, TB: 600, TA: 600, CX: 300 }, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('cualquier PARCIAL → estadoGeneralCalculo≥PARCIAL', async () => {
      configEvaluar(
        mkR08({}, EstadoCalculo.PARCIAL),
        mkR09(2400, { horasMinTotales: 2000 }, { CB: 600, TB: 700, TA: 700, CX: 400 }),
      );
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      const pesoEstado: Record<string, number> = { CALCULADO: 1, NO_APLICA: 2, PARCIAL: 3, NO_DETERMINABLE: 4 };
      expect(pesoEstado[res.estadoGeneralCalculo]).toBeGreaterThanOrEqual(pesoEstado[EstadoCalculo.PARCIAL]);
    });

    it('NO_DETERMINABLE domina sobre CALCULADO', async () => {
      // R-08 falla con error interno → IPL-03 = NO_DETERMINABLE
      mockIndicadores.evaluar.mockImplementation((s: { codigoIndicador: string }) => {
        if (s.codigoIndicador === 'R-08') return Promise.reject(new Error('DB error'));
        return Promise.resolve(mkR09(2400, { horasMinTotales: 2000, CB: 400 }, { CB: 600 }));
      });
      const res = await service.consultarPlan(PLAN_ID, 'u1', 'ADMINISTRADOR_SISTEMA');
      expect(res.estadoGeneralCalculo).toBe(EstadoCalculo.NO_DETERMINABLE);
    });
  });
});
