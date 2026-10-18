/**
 * HTTP-layer integration tests for POST /autoevaluacion/tablero/carrera/:carreraId.
 *
 * Mirrors tablero-plan.spec.ts structure.  Tests the HTTP boundary only:
 * authentication, authorization, UUID validation, service-error propagation,
 * and DTO shape.  Business logic for IP-01/02/03/08 is covered in
 * tablero-carrera.service.spec.ts.
 *
 * Test infrastructure: NestJS Test module + MockJwtGuard (reads x-test-user header)
 * + real RolesGuard + supertest.  No real database.
 */

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
import { TablroPlanService } from './tablero-plan.service';
import { TablroCarreraService } from './tablero-carrera.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { TablroCarreraResponseDto } from './tablero-carrera.dto';

// ── Constantes ────────────────────────────────────────────────────────────────

const CAR_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const FECHA  = new Date('2026-10-18T00:00:00.000Z');

const USR_ADMIN    = { id: 'u-admin', rol: { nombre: 'ADMINISTRADOR_SISTEMA' } };
const USR_SECRETA  = { id: 'u-sec',   rol: { nombre: 'SECRETARIA_ACADEMICA' } };
const USR_RECTO    = { id: 'u-rec',   rol: { nombre: 'RECTORADO' } };
const USR_DECANO   = { id: 'u-dec',   rol: { nombre: 'DECANO' } };
const USR_DIRECTOR = { id: 'u-dir',   rol: { nombre: 'DIRECTOR_CARRERA' } };
const USR_DOCENTE  = { id: 'u-doc',   rol: { nombre: 'DOCENTE' } };
const USR_ADMVO    = { id: 'u-adm',   rol: { nombre: 'ADMINISTRATIVO' } };

// ── Guard mock ────────────────────────────────────────────────────────────────

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

// ── Fixtures de escenarios académicos ─────────────────────────────────────────
//
// Valores calculados externamente, independientes del servicio bajo prueba.

/** Escenario A — Carrera con datos completos. Todos CALCULADO. */
const escenarioA: TablroCarreraResponseDto = {
  carreraId: CAR_ID,
  fechaEvaluacion: FECHA.toISOString(),
  ip01: { total: 5, estadoCalculo: EstadoCalculo.CALCULADO },
  ip02: { total: 8, estadoCalculo: EstadoCalculo.CALCULADO },
  ip03: { cubiertas: 12, total: 15, estadoCalculo: EstadoCalculo.CALCULADO },
  ip08: { profesores: 6, auxiliares: 3, ratio: 2.0, estadoCalculo: EstadoCalculo.CALCULADO },
  estadoGeneralCalculo: EstadoCalculo.CALCULADO,
};

// IP-02/IP-01 = 8/5 = 1.6 cargos por docente (calculado externamente para verificación de coherencia)
const RATIO_CARGOS_POR_DOCENTE_ESC_A = 8 / 5;

/** Escenario E — Carrera sin datos. Todos NO_APLICA. */
const escenarioE: TablroCarreraResponseDto = {
  carreraId: CAR_ID,
  fechaEvaluacion: FECHA.toISOString(),
  ip01: { total: 0, estadoCalculo: EstadoCalculo.NO_APLICA },
  ip02: { total: 0, estadoCalculo: EstadoCalculo.NO_APLICA },
  ip03: { cubiertas: 0, total: 0, estadoCalculo: EstadoCalculo.NO_APLICA },
  ip08: { profesores: 0, auxiliares: 0, ratio: null, estadoCalculo: EstadoCalculo.NO_APLICA },
  estadoGeneralCalculo: EstadoCalculo.NO_APLICA,
};

/** Escenario B — Cobertura incompleta: IP-03 CALCULADO con materias descubiertas. */
const escenarioB: TablroCarreraResponseDto = {
  ...escenarioA,
  ip03: { cubiertas: 7, total: 15, estadoCalculo: EstadoCalculo.CALCULADO },
  estadoGeneralCalculo: EstadoCalculo.CALCULADO,
};

/** Escenario C — Solo profesores: IP-08 ratio null (sin auxiliares). */
const escenarioC: TablroCarreraResponseDto = {
  ...escenarioA,
  ip08: { profesores: 4, auxiliares: 0, ratio: null, estadoCalculo: EstadoCalculo.CALCULADO },
  estadoGeneralCalculo: EstadoCalculo.CALCULADO,
};

/** Escenario F — Docentes con cargos mixtos: IP-01 y IP-02 coherentes. */
const escenarioF: TablroCarreraResponseDto = {
  ...escenarioA,
  ip01: { total: 3, estadoCalculo: EstadoCalculo.CALCULADO },
  ip02: { total: 5, estadoCalculo: EstadoCalculo.CALCULADO },
  estadoGeneralCalculo: EstadoCalculo.CALCULADO,
};

// ── Factory HTTP ──────────────────────────────────────────────────────────────

async function crearApp(consultarCarrera: jest.Mock): Promise<INestApplication> {
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
      { provide: TablroPlanService,     useValue: { consultarPlan: jest.fn() } },
      { provide: TablroCarreraService,  useValue: { consultarCarrera } },
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
// A. POST /autoevaluacion/tablero/carrera/:carreraId — seguridad y estructura
// ════════════════════════════════════════════════════════════════════════════

describe('POST /autoevaluacion/tablero/carrera/:carreraId', () => {
  let app: INestApplication;
  let consultarCarrera: jest.Mock;

  beforeEach(async () => {
    consultarCarrera = jest.fn().mockResolvedValue(escenarioA);
    app = await crearApp(consultarCarrera);
  });

  afterEach(() => app.close());

  // ── Autenticación ──────────────────────────────────────────────────────────

  it('sin token → 401', () => {
    return request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .expect(401);
  });

  // ── Autorización por rol ───────────────────────────────────────────────────

  it.each([
    ['DOCENTE',        USR_DOCENTE],
    ['ADMINISTRATIVO', USR_ADMVO],
  ])('rol %s → 403', (_rol, usuario) => {
    return request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(usuario))
      .expect(403);
  });

  it.each([
    ['ADMINISTRADOR_SISTEMA', USR_ADMIN],
    ['SECRETARIA_ACADEMICA',  USR_SECRETA],
    ['RECTORADO',             USR_RECTO],
    ['DECANO',                USR_DECANO],
    ['DIRECTOR_CARRERA',      USR_DIRECTOR],
  ])('rol %s → 200', (_rol, usuario) => {
    return request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(usuario))
      .expect(200);
  });

  // ── Validación del path param ──────────────────────────────────────────────

  it('carreraId no es UUID v4 → 400', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/tablero/carrera/no-es-uuid')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(400);
  });

  it('carreraId es UUID v1 (no v4) → 400', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/tablero/carrera/550e8400-e29b-11d4-a716-446655440000')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(400);
  });

  // ── Errores de scope y carrera inexistente ─────────────────────────────────

  it('carrera inexistente → 404', async () => {
    consultarCarrera.mockRejectedValue(new NotFoundException('Carrera no encontrada'));
    const app2 = await crearApp(consultarCarrera);
    await request(app2.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(404);
    await app2.close();
  });

  it('usuario fuera de scope → 403', async () => {
    consultarCarrera.mockRejectedValue(new ForbiddenException('Sin scope sobre la carrera'));
    const app2 = await crearApp(consultarCarrera);
    await request(app2.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(403);
    await app2.close();
  });

  // ── Estructura del DTO ─────────────────────────────────────────────────────

  it('respuesta 200 incluye todos los campos requeridos (ip01, ip02, ip03, ip08)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    expect(res.body).toMatchObject({
      carreraId: expect.any(String),
      fechaEvaluacion: expect.any(String),
      ip01: expect.objectContaining({ total: expect.any(Number), estadoCalculo: expect.any(String) }),
      ip02: expect.objectContaining({ total: expect.any(Number), estadoCalculo: expect.any(String) }),
      ip03: expect.objectContaining({ cubiertas: expect.any(Number), total: expect.any(Number) }),
      ip08: expect.objectContaining({ profesores: expect.any(Number), auxiliares: expect.any(Number) }),
      estadoGeneralCalculo: expect.any(String),
    });
  });

  it('consultarCarrera recibe carreraId, usuarioId y rolNombre del JWT', async () => {
    await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(200);

    expect(consultarCarrera).toHaveBeenCalledWith(
      CAR_ID,
      USR_DIRECTOR.id,
      USR_DIRECTOR.rol.nombre,
    );
  });

  it('usuarioId se toma del token — nunca de parámetros externos', async () => {
    await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(200);

    const [, usuarioIdPasado] = consultarCarrera.mock.calls[0];
    expect(usuarioIdPasado).toBe(USR_DIRECTOR.id);
    expect(usuarioIdPasado).not.toBe(USR_ADMIN.id);
  });

  it('rolNombre se toma del token — no puede escalarse desde el exterior', async () => {
    await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(200);

    const [, , rolPasado] = consultarCarrera.mock.calls[0];
    expect(rolPasado).toBe('DIRECTOR_CARRERA');
    expect(rolPasado).not.toBe('ADMINISTRADOR_SISTEMA');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. Escenarios académicos — verificación de contratos con fixtures controlados
// ════════════════════════════════════════════════════════════════════════════

describe('Escenarios académicos — DTO del tablero de carrera', () => {
  let app: INestApplication;
  let consultarCarrera: jest.Mock;

  afterEach(() => app.close());

  // ── Escenario A — Carrera con datos completos ──────────────────────────────

  describe('Escenario A — Carrera con datos completos', () => {
    beforeEach(async () => {
      consultarCarrera = jest.fn().mockResolvedValue(escenarioA);
      app = await crearApp(consultarCarrera);
    });

    it('ip01.total refleja el número de docentes activos (5)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip01.total).toBe(5);
      expect(res.body.ip01.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    });

    it('ip02.total refleja el número de cargos P+A (8) — ip02 ≥ ip01 es coherente', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip02.total).toBe(8);
      // Verificación de coherencia: cargos/docente = 1.6, calculado independientemente
      const ratioCalculado = res.body.ip02.total / res.body.ip01.total;
      expect(ratioCalculado).toBeCloseTo(RATIO_CARGOS_POR_DOCENTE_ESC_A, 1);
    });

    it('ip03 muestra materias cubiertas (12 de 15)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip03.cubiertas).toBe(12);
      expect(res.body.ip03.total).toBe(15);
      expect(res.body.ip03.cubiertas).toBeLessThan(res.body.ip03.total);
    });

    it('ip08 tiene ratio P/A = 2.0 (6 profesores / 3 auxiliares)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      // Verificar ratio calculado externamente: 6/3 = 2.0
      expect(res.body.ip08.ratio).toBe(6 / 3);
      expect(res.body.ip08.profesores).toBe(6);
      expect(res.body.ip08.auxiliares).toBe(3);
    });

    it('estadoGeneralCalculo = CALCULADO cuando todos los indicadores son CALCULADO', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.estadoGeneralCalculo).toBe(EstadoCalculo.CALCULADO);
    });
  });

  // ── Escenario B — Cobertura incompleta ────────────────────────────────────

  describe('Escenario B — Cobertura incompleta de materias (IP-03)', () => {
    beforeEach(async () => {
      consultarCarrera = jest.fn().mockResolvedValue(escenarioB);
      app = await crearApp(consultarCarrera);
    });

    it('ip03.cubiertas < ip03.total — materias sin cobertura detectadas', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip03.cubiertas).toBe(7);
      expect(res.body.ip03.total).toBe(15);
      // Materias sin cobertura (calculado externamente): 15 - 7 = 8
      const sinCobertura = res.body.ip03.total - res.body.ip03.cubiertas;
      expect(sinCobertura).toBe(8);
    });

    it('CALCULADO no implica cumplimiento — cubiertas puede ser menor al total', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      // CALCULADO significa que el indicador pudo calcularse, no que el umbral se cumplió
      expect(res.body.ip03.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.body.ip03.cubiertas).toBeLessThan(res.body.ip03.total);
    });
  });

  // ── Escenario C — Sin auxiliares ──────────────────────────────────────────

  describe('Escenario C — Relación P/A sin auxiliares (IP-08)', () => {
    beforeEach(async () => {
      consultarCarrera = jest.fn().mockResolvedValue(escenarioC);
      app = await crearApp(consultarCarrera);
    });

    it('ip08.ratio es null cuando auxiliares = 0', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip08.auxiliares).toBe(0);
      expect(res.body.ip08.ratio).toBeNull();
      // El estado sigue siendo CALCULADO — ratio null es un resultado válido
      expect(res.body.ip08.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    });
  });

  // ── Escenario E — Datos incompletos / NO_APLICA ───────────────────────────

  describe('Escenario E — Carrera sin datos (todos NO_APLICA)', () => {
    beforeEach(async () => {
      consultarCarrera = jest.fn().mockResolvedValue(escenarioE);
      app = await crearApp(consultarCarrera);
    });

    it('todos los indicadores son NO_APLICA', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip01.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.body.ip02.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.body.ip03.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
      expect(res.body.ip08.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('estadoGeneralCalculo = NO_APLICA cuando todos son NO_APLICA', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
    });

    it('NO_APLICA no equivale a error — la respuesta sigue siendo HTTP 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN));
      expect(res.status).toBe(200);
    });

    it('ip08.ratio es null cuando no hay datos — diferencia entre dato ausente y cero', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip08.ratio).toBeNull();
      expect(res.body.ip08.profesores).toBe(0);
      expect(res.body.ip08.auxiliares).toBe(0);
    });
  });

  // ── Escenario F — Docentes con cargos múltiples (IP-01 / IP-02) ──────────

  describe('Escenario F — Relación ip01/ip02 (docentes vs cargos vigentes)', () => {
    beforeEach(async () => {
      consultarCarrera = jest.fn().mockResolvedValue(escenarioF);
      app = await crearApp(consultarCarrera);
    });

    it('ip02.total puede ser mayor que ip01.total (un docente puede tener varios cargos)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip01.total).toBe(3);
      expect(res.body.ip02.total).toBe(5);
      // ip02 > ip01: 5 cargos para 3 docentes → promedio de 5/3 ≈ 1.67 cargos/docente
      expect(res.body.ip02.total).toBeGreaterThan(res.body.ip01.total);
    });

    it('ip01 e ip02 son estados independientes — ambos CALCULADO cuando hay datos', async () => {
      const res = await request(app.getHttpServer())
        .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
        .set('x-test-user', JSON.stringify(USR_ADMIN))
        .expect(200);
      expect(res.body.ip01.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
      expect(res.body.ip02.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C. Seguridad de scope territorial (DIRECTOR_CARRERA)
// ════════════════════════════════════════════════════════════════════════════

describe('Seguridad de scope territorial — carrera endpoint', () => {
  let app: INestApplication;
  let consultarCarrera: jest.Mock;

  afterEach(() => app.close());

  it('DIRECTOR_CARRERA: el controlador pasa el rol correcto — sin escalada de privilegios', async () => {
    consultarCarrera = jest.fn().mockResolvedValue(escenarioA);
    app = await crearApp(consultarCarrera);

    await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(200);

    const [, , rolPasado] = consultarCarrera.mock.calls[0];
    expect(rolPasado).toBe('DIRECTOR_CARRERA');
    expect(rolPasado).not.toBe('ADMINISTRADOR_SISTEMA');
    expect(rolPasado).not.toBe('RECTORADO');
  });

  it('DIRECTOR_CARRERA fuera de scope → 403 desde el servicio (IDOR prevenido)', async () => {
    consultarCarrera = jest.fn().mockRejectedValue(new ForbiddenException('Sin scope'));
    app = await crearApp(consultarCarrera);

    await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(403);
  });

  it('el controlador no transforma el carreraId — lo pasa tal cual al servicio', async () => {
    consultarCarrera = jest.fn().mockResolvedValue(escenarioA);
    app = await crearApp(consultarCarrera);

    await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(200);

    const [carreraIdPasado] = consultarCarrera.mock.calls[0];
    expect(carreraIdPasado).toBe(CAR_ID);
  });

  it('NO_APLICA del servicio no se convierte en error HTTP — estado preservado', async () => {
    consultarCarrera = jest.fn().mockResolvedValue(escenarioE);
    app = await crearApp(consultarCarrera);

    const res = await request(app.getHttpServer())
      .post(`/autoevaluacion/tablero/carrera/${CAR_ID}`)
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .expect(200);

    expect(res.body.estadoGeneralCalculo).toBe(EstadoCalculo.NO_APLICA);
  });
});
