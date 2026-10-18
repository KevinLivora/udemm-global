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
import { AutoevaluacionController } from './autoevaluacion.controller';
import { ConfigFacultadService } from './config/config-facultad.service';
import { ConfigPlanService } from './config/config-plan.service';
import { ResponsablesService } from './responsables/responsables.service';
import { IndicadoresService } from './indicadores/indicadores.service';
import { RegistroIndicadores } from './indicadores/indicadores.registry';
import type { DefinicionIndicador } from './indicadores/indicadores.registry';
import { TablroPlanService } from './tablero/tablero-plan.service';
import { TablroCarreraService } from './tablero/tablero-carrera.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EstadoCalculo } from './types/estado-calculo.types';
import type { ResultadoIndicador } from './indicadores/indicadores.types';

// ── Constantes ───────────────────────────────────────────────────────────────

const CAR_ID       = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const PLAN_ID      = 'b2c3d4e5-f6a7-4901-bcde-f01234567891';
const CAR_AJENA_ID = 'f1f2f3f4-f5f6-4f90-afff-000000000000';
const FECHA   = new Date('2026-10-15');

const USR_ADMIN    = { id: 'u-admin',   rol: { nombre: 'ADMINISTRADOR_SISTEMA' } };
const USR_SECRETA  = { id: 'u-sec',     rol: { nombre: 'SECRETARIA_ACADEMICA' } };
const USR_RECTO    = { id: 'u-recto',   rol: { nombre: 'RECTORADO' } };
const USR_DECANO   = { id: 'u-decano',  rol: { nombre: 'DECANO' } };
const USR_DIRECTOR = { id: 'u-dir',     rol: { nombre: 'DIRECTOR_CARRERA' } };
const USR_DOCENTE  = { id: 'u-doc',     rol: { nombre: 'DOCENTE' } };
const USR_ADMVO    = { id: 'u-adm',     rol: { nombre: 'ADMINISTRATIVO' } };

// ── Guard mock ────────────────────────────────────────────────────────────────
//
// Lee el usuario de la cabecera x-test-user (JSON) para controlar auth en tests.
// Lanza UnauthorizedException si la cabecera está ausente.
// En producción este guard es sustituido por JwtAuthGuard real.

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defImplementado: DefinicionIndicador = {
  codigo: 'R-02',
  nombre: 'Doble responsable de cátedra',
  descripcion: 'Una asignatura no puede tener dos responsables al mismo tiempo.',
  tipo: 'ALERTA',
  severidad: 'ALTA',
  alcance: 'PLAN',
  estadoImplementacion: 'IMPLEMENTADO',
  // evaluador intencional: debe ser excluido de la respuesta HTTP
  evaluador: { evaluar: jest.fn() } as any,
};

const defNoImpl: DefinicionIndicador = {
  codigo: 'R-11',
  nombre: 'Inconsistencias en programas',
  descripcion: 'Campos incompletos o repetidos en programas.',
  tipo: 'ALERTA',
  severidad: 'MEDIA',
  alcance: 'PLAN',
  estadoImplementacion: 'NO_IMPLEMENTADO',
  motivoPendiente: 'D-12: calcAvancePrograma pendiente de definición.',
};

const definiciones: DefinicionIndicador[] = [defImplementado, defNoImpl];

const resultadoCalculado: ResultadoIndicador<boolean[]> = {
  codigo: 'R-02',
  contextoId: PLAN_ID,
  tipoContexto: 'PLAN',
  estadoImplementacion: 'IMPLEMENTADO',
  estadoCalculo: EstadoCalculo.CALCULADO,
  valor: [],
  datosFaltantes: [],
  fechaEvaluacion: FECHA,
};

// ── Factory ───────────────────────────────────────────────────────────────────

async function crearApp(overrides: {
  evaluar?: jest.Mock;
  listar?: jest.Mock;
} = {}): Promise<{ app: INestApplication; evaluar: jest.Mock; listar: jest.Mock }> {
  const evaluar = overrides.evaluar ?? jest.fn().mockResolvedValue(resultadoCalculado);
  const listar  = overrides.listar  ?? jest.fn().mockReturnValue(definiciones);

  // RolesGuard con Reflector real para probar autorización correctamente
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
      { provide: IndicadoresService,    useValue: { evaluar } },
      { provide: RegistroIndicadores,   useValue: { listar } },
      { provide: TablroPlanService,     useValue: { consultarPlan: jest.fn() } },
      { provide: TablroCarreraService,  useValue: { consultarCarrera: jest.fn() } },
    ],
  })
    .overrideGuard(JwtAuthGuard).useClass(MockJwtGuard)
    .overrideGuard(RolesGuard).useValue(rolesGuardInstance)
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();

  return { app, evaluar, listar };
}

// ════════════════════════════════════════════════════════════════════════════
// A. GET /autoevaluacion/indicadores
// ════════════════════════════════════════════════════════════════════════════

describe('GET /autoevaluacion/indicadores', () => {
  let app: INestApplication;
  let evaluar: jest.Mock;
  let listar: jest.Mock;

  beforeEach(async () => {
    ({ app, evaluar, listar } = await crearApp());
  });

  afterEach(() => app.close());

  // ── Autenticación ──────────────────────────────────────────────────────────

  it('sin token → 401', () => {
    return request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .expect(401);
  });

  // ── Autorización ──────────────────────────────────────────────────────────

  it.each([USR_ADMIN, USR_SECRETA, USR_RECTO, USR_DECANO, USR_DIRECTOR])(
    'rol $rol.nombre → 200',
    async (usr) => {
      await request(app.getHttpServer())
        .get('/autoevaluacion/indicadores')
        .set('x-test-user', JSON.stringify(usr))
        .expect(200);
    },
  );

  it('DOCENTE → 403', () => {
    return request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_DOCENTE))
      .expect(403);
  });

  it('ADMINISTRATIVO → 403', () => {
    return request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMVO))
      .expect(403);
  });

  // ── Metadatos ─────────────────────────────────────────────────────────────

  it('devuelve array con todos los indicadores registrados', async () => {
    const res = await request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('indicador IMPLEMENTADO tiene los metadatos correctos', async () => {
    const res = await request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    const r02 = res.body.find((i: any) => i.codigo === 'R-02');
    expect(r02).toBeDefined();
    expect(r02.nombre).toBe('Doble responsable de cátedra');
    expect(r02.tipo).toBe('ALERTA');
    expect(r02.severidad).toBe('ALTA');
    expect(r02.alcance).toBe('PLAN');
    expect(r02.estadoImplementacion).toBe('IMPLEMENTADO');
    expect(r02.motivoPendiente).toBeUndefined();
  });

  it('indicador NO_IMPLEMENTADO incluye motivoPendiente', async () => {
    const res = await request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    const r11 = res.body.find((i: any) => i.codigo === 'R-11');
    expect(r11.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    expect(r11.motivoPendiente).toBe('D-12: calcAvancePrograma pendiente de definición.');
  });

  it('NO expone instancias de evaluadores', async () => {
    const res = await request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    for (const ind of res.body) {
      expect(ind.evaluador).toBeUndefined();
    }
  });

  it('NO expone campos internos (_mapa, dependencias, etc.)', async () => {
    const res = await request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    const camposPermitidos = new Set([
      'codigo', 'nombre', 'descripcion', 'tipo', 'severidad',
      'alcance', 'estadoImplementacion', 'motivoPendiente',
    ]);
    for (const ind of res.body) {
      for (const key of Object.keys(ind)) {
        expect(camposPermitidos.has(key)).toBe(true);
      }
    }
  });

  it('no ejecuta ningún evaluador al listar', async () => {
    await request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    expect(evaluar).not.toHaveBeenCalled();
    expect((defImplementado.evaluador as any).evaluar).not.toHaveBeenCalled();
  });

  it('no incluye datos personales docentes en la respuesta', async () => {
    const res = await request(app.getHttpServer())
      .get('/autoevaluacion/indicadores')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .expect(200);

    const body = JSON.stringify(res.body);
    // Sin campos típicos de ficha docente
    expect(body).not.toMatch(/"nombre":"[^"]+","apellido"/);
    expect(body).not.toMatch(/correoElectronico|numeroDocumento/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. POST /autoevaluacion/indicadores/:codigo/evaluar
// ════════════════════════════════════════════════════════════════════════════

describe('POST /autoevaluacion/indicadores/:codigo/evaluar', () => {
  let app: INestApplication;
  let evaluar: jest.Mock;

  beforeEach(async () => {
    ({ app, evaluar } = await crearApp());
  });

  afterEach(() => app.close());

  // ── Autenticación ──────────────────────────────────────────────────────────

  it('sin token → 401', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .send({ planEstudioId: PLAN_ID })
      .expect(401);
  });

  // ── Autorización ──────────────────────────────────────────────────────────

  it.each([USR_ADMIN, USR_SECRETA, USR_RECTO, USR_DECANO, USR_DIRECTOR])(
    'rol $rol.nombre → 200',
    async (usr) => {
      await request(app.getHttpServer())
        .post('/autoevaluacion/indicadores/R-02/evaluar')
        .set('x-test-user', JSON.stringify(usr))
        .send({ planEstudioId: PLAN_ID })
        .expect(200);
    },
  );

  it('DOCENTE → 403', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_DOCENTE))
      .send({ planEstudioId: PLAN_ID })
      .expect(403);
  });

  it('ADMINISTRATIVO → 403', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMVO))
      .send({ planEstudioId: PLAN_ID })
      .expect(403);
  });

  // ── Respuesta 200 (no 201) ────────────────────────────────────────────────

  it('devuelve HTTP 200 — la evaluación no crea un recurso', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID })
      .expect(200);
  });

  // ── Construcción segura del contexto ─────────────────────────────────────

  it('usuarioId se toma del token — nunca del body', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID, usuarioId: 'impostor-id' })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.contexto.usuarioId).toBe(USR_ADMIN.id);
    expect(solicitud.contexto.usuarioId).not.toBe('impostor-id');
  });

  it('rolNombre se toma del token — nunca del body', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .send({ planEstudioId: PLAN_ID, rolNombre: 'ADMINISTRADOR_SISTEMA' })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.contexto.rolNombre).toBe('DIRECTOR_CARRERA');
    expect(solicitud.contexto.rolNombre).not.toBe('ADMINISTRADOR_SISTEMA');
  });

  it('campos desconocidos del body son descartados (whitelist)', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID, campoArbitrario: 'valor', scopeExtra: true })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.contexto).not.toHaveProperty('campoArbitrario');
    expect(solicitud.contexto).not.toHaveProperty('scopeExtra');
  });

  it('codigoIndicador se toma del path param', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-09/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.codigoIndicador).toBe('R-09');
  });

  it('carreraId y planEstudioId opcionales se pasan al contexto', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ carreraId: CAR_ID, planEstudioId: PLAN_ID })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.contexto.carreraId).toBe(CAR_ID);
    expect(solicitud.contexto.planEstudioId).toBe(PLAN_ID);
  });

  it('body vacío es válido para roles globales', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-08/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({})
      .expect(200);
  });

  // ── Validación de DTO ─────────────────────────────────────────────────────

  it('carreraId no UUID → 400', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-06/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ carreraId: 'no-es-uuid' })
      .expect(400);
  });

  it('planEstudioId no UUID → 400', () => {
    return request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-08/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: '123' })
      .expect(400);
  });

  it('carreraId UUID v4 válido es aceptado', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-06/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ carreraId: CAR_ID })
      .expect(200);
  });

  // ── Errores del servicio ──────────────────────────────────────────────────

  it('código desconocido → 404 (NotFoundException desde IndicadoresService)', async () => {
    evaluar.mockRejectedValueOnce(
      new NotFoundException('Indicador R-INEXISTENTE no está registrado en MOD-AUT'),
    );

    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-INEXISTENTE/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({})
      .expect(404);
  });

  it('scope inválido → 403 (ForbiddenException desde IndicadoresService)', async () => {
    evaluar.mockRejectedValueOnce(new ForbiddenException());

    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .send({ carreraId: CAR_ID })
      .expect(403);
  });

  // ── Preservación de estados de cálculo ───────────────────────────────────

  it('CALCULADO se preserva', async () => {
    evaluar.mockResolvedValueOnce({ ...resultadoCalculado, estadoCalculo: EstadoCalculo.CALCULADO });

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID })
      .expect(200);

    expect(res.body.estadoCalculo).toBe('CALCULADO');
  });

  it('PARCIAL no se convierte en CALCULADO', async () => {
    const resultadoParcial: ResultadoIndicador<unknown> = {
      ...resultadoCalculado,
      estadoCalculo: EstadoCalculo.PARCIAL,
      datosFaltantes: [{ campo: 'cargo', entidad: 'Docente', descripcion: 'No confirmado' }],
    };
    evaluar.mockResolvedValueOnce(resultadoParcial);

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ carreraId: CAR_ID })
      .expect(200);

    expect(res.body.estadoCalculo).toBe('PARCIAL');
    expect(res.body.datosFaltantes).toHaveLength(1);
  });

  it('NO_DETERMINABLE no se convierte en null ni en 0', async () => {
    const resultadoND: ResultadoIndicador<unknown> = {
      ...resultadoCalculado,
      estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      valor: null,
    };
    evaluar.mockResolvedValueOnce(resultadoND);

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ carreraId: CAR_ID })
      .expect(200);

    expect(res.body.estadoCalculo).toBe('NO_DETERMINABLE');
    expect(res.body.valor).toBeNull();
  });

  it('NO_APLICA se preserva', async () => {
    const resultadoNA: ResultadoIndicador<unknown> = {
      ...resultadoCalculado,
      estadoCalculo: EstadoCalculo.NO_APLICA,
      valor: null,
    };
    evaluar.mockResolvedValueOnce(resultadoNA);

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-09/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID })
      .expect(200);

    expect(res.body.estadoCalculo).toBe('NO_APLICA');
    expect(res.body.valor).toBeNull();
  });

  it('NO_IMPLEMENTADO preserva estadoCalculo=null y valor=null', async () => {
    const resultadoNI: ResultadoIndicador<unknown> = {
      codigo: 'R-11',
      contextoId: PLAN_ID,
      tipoContexto: 'PLAN',
      estadoImplementacion: 'NO_IMPLEMENTADO',
      estadoCalculo: null,
      valor: null,
      datosFaltantes: [],
      fechaEvaluacion: FECHA,
    };
    evaluar.mockResolvedValueOnce(resultadoNI);

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-11/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID })
      .expect(200);

    expect(res.body.estadoImplementacion).toBe('NO_IMPLEMENTADO');
    expect(res.body.estadoCalculo).toBeNull();
    expect(res.body.valor).toBeNull();
  });

  it('datosFaltantes se conservan sin modificación', async () => {
    const faltantes = [
      { campo: 'tiempoGestionAcademica', entidad: 'Docente', descripcion: 'String? no parseable' },
      { campo: 'cargo', entidad: 'Docente', descripcion: 'No confirmado' },
    ];
    evaluar.mockResolvedValueOnce({
      ...resultadoCalculado,
      estadoCalculo: EstadoCalculo.PARCIAL,
      datosFaltantes: faltantes,
    });

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-02/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ planEstudioId: PLAN_ID })
      .expect(200);

    expect(res.body.datosFaltantes).toHaveLength(2);
    expect(res.body.datosFaltantes[0].campo).toBe('tiempoGestionAcademica');
  });

  // ── Evaluadores implementados ─────────────────────────────────────────────

  it.each([
    { codigo: 'R-02', body: { planEstudioId: PLAN_ID } },
    { codigo: 'R-06', body: { carreraId: CAR_ID } },
    { codigo: 'R-07', body: { carreraId: CAR_ID } },
    { codigo: 'R-08', body: { planEstudioId: PLAN_ID } },
    { codigo: 'R-09', body: { planEstudioId: PLAN_ID } },
  ])('$codigo: ADMIN puede evaluar y recibe resultado del servicio', async ({ codigo, body }) => {
    evaluar.mockResolvedValueOnce({ ...resultadoCalculado, codigo });

    const res = await request(app.getHttpServer())
      .post(`/autoevaluacion/indicadores/${codigo}/evaluar`)
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send(body)
      .expect(200);

    expect(res.body.codigo).toBe(codigo);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C. Seguridad específica R-07
// ════════════════════════════════════════════════════════════════════════════

describe('R-07 — Seguridad de scope territorial', () => {
  let app: INestApplication;
  let evaluar: jest.Mock;

  beforeEach(async () => {
    ({ app, evaluar } = await crearApp());
  });

  afterEach(() => app.close());

  it('DIRECTOR_CARRERA: el controlador pasa el rol correcto — sin escalada', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .send({ carreraId: CAR_ID })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.contexto.rolNombre).toBe('DIRECTOR_CARRERA');
    expect(solicitud.contexto.usuarioId).toBe(USR_DIRECTOR.id);
  });

  it('DIRECTOR_CARRERA: resultado PARCIAL del servicio se preserva sin conversión', async () => {
    evaluar.mockResolvedValueOnce({
      ...resultadoCalculado,
      codigo: 'R-07',
      estadoCalculo: EstadoCalculo.PARCIAL,
    });

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .send({ carreraId: CAR_ID })
      .expect(200);

    expect(res.body.estadoCalculo).toBe('PARCIAL');
  });

  it('el controlador no transforma el carreraId — lo pasa tal cual al servicio', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ carreraId: CAR_ID })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.contexto.carreraId).toBe(CAR_ID);
  });

  it('DIRECTOR_CARRERA fuera de scope → 403 desde el servicio', async () => {
    evaluar.mockRejectedValueOnce(new ForbiddenException());

    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .send({ carreraId: CAR_AJENA_ID })
      .expect(403);
  });

  it('intento de impersonar admin desde body → rolNombre del token se conserva', async () => {
    await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_DIRECTOR))
      .send({ carreraId: CAR_ID, rolNombre: 'ADMINISTRADOR_SISTEMA', usuarioId: 'admin-falso' })
      .expect(200);

    const [solicitud] = evaluar.mock.calls[0];
    expect(solicitud.contexto.rolNombre).toBe('DIRECTOR_CARRERA');
    expect(solicitud.contexto.usuarioId).toBe(USR_DIRECTOR.id);
    expect(solicitud.contexto.usuarioId).not.toBe('admin-falso');
  });

  it('NO_DETERMINABLE de docente multi-facultad se preserva', async () => {
    evaluar.mockResolvedValueOnce({
      ...resultadoCalculado,
      codigo: 'R-07',
      estadoCalculo: EstadoCalculo.NO_DETERMINABLE,
      valor: null,
    });

    const res = await request(app.getHttpServer())
      .post('/autoevaluacion/indicadores/R-07/evaluar')
      .set('x-test-user', JSON.stringify(USR_ADMIN))
      .send({ carreraId: CAR_ID })
      .expect(200);

    expect(res.body.estadoCalculo).toBe('NO_DETERMINABLE');
    expect(res.body.valor).toBeNull();
  });
});
