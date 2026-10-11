/**
 * C16.3 — Test de integración: concurrencia real contra PostgreSQL
 *
 * Verifica que SELECT ... FOR UPDATE serializa dos solicitudes concurrentes
 * para el mismo programa, resultando en exactamente una solicitud creada,
 * un historial, y cero duplicados de notificaciones por usuario.
 *
 * ── REQUISITOS DE CONFIGURACIÓN ──────────────────────────────────────────────
 *
 *  1. Crear una base de datos PostgreSQL EXCLUSIVA para tests de integración:
 *       createdb udemm_test          (o el nombre que corresponda)
 *
 *  2. Aplicar el schema en esa BD:
 *       DATABASE_URL="postgresql://user:pass@localhost:5432/udemm_test" \
 *         npx prisma migrate deploy
 *
 *  3. Definir la variable de entorno TEST_INTEGRATION_DATABASE_URL:
 *       export TEST_INTEGRATION_DATABASE_URL="postgresql://user:pass@localhost:5432/udemm_test"
 *
 *  4. Ejecutar el test:
 *       TEST_INTEGRATION_DATABASE_URL="postgresql://..." \
 *         npx jest --testPathPattern="programas-c162-concurrencia" --runInBand --forceExit --no-coverage
 *
 * ── GARANTÍAS DE SEGURIDAD ───────────────────────────────────────────────────
 *
 *  • Si TEST_INTEGRATION_DATABASE_URL no está definida → test omitido (describe.skip).
 *  • Si apunta a "udemm_global" → beforeAll lanza error antes de tocar la BD.
 *  • Si el nombre de la BD contiene "prod" → ídem.
 *  • Todos los fixtures son creados en beforeAll y eliminados en afterAll.
 *  • Ningún registro preexistente en la BD es modificado ni eliminado.
 *
 * ── NOTA SOBRE CONCURRENCIA ──────────────────────────────────────────────────
 *
 *  Promise.all lanza ambas llamadas sin await intermedio. Cada $transaction
 *  abre una conexión dedicada del pool. PostgreSQL serializa ambas transacciones
 *  en el SELECT ... FOR UPDATE: la segunda bloquea hasta que la primera confirme,
 *  luego detecta la solicitud ya creada y retorna OMITIDO.
 *
 *  Si el pool tiene solo 1 conexión, las transacciones se ejecutan en serie
 *  (no en paralelo real a nivel DB), pero el resultado esperado es el mismo:
 *  una GENERADA y una OMITIDO. Para garantizar paralelismo real, la URL de test
 *  debe admitir al menos 2 conexiones (default del pool de Prisma: suficiente).
 */

import { PrismaClient } from '@prisma/client';
import { ProgramasService } from './programas.service';
import { ScopeService } from '../scopes/scope.service';
import { GenerarRegularizacionDto } from './dto/generar-regularizacion.dto';

// ── Guarda de seguridad ───────────────────────────────────────────────────────
// Si TEST_INTEGRATION_DATABASE_URL no está definida, el test se omite.
// Usar describe.skip evita errores en la suite unitaria normal.
const TEST_DB_URL = process.env.TEST_INTEGRATION_DATABASE_URL ?? '';
const integrationDescribe = TEST_DB_URL ? describe : describe.skip;

// ── Constantes de fixture ─────────────────────────────────────────────────────
const TEXTO = 'x'.repeat(55);

interface TestFixtures {
  rolId:      string;
  univId:     string;
  usuarioId:  string;
  facultadId: string;
  carreraId:  string;
  planId:     string;
  materiaId:  string;
  programaId: string;
}

// ── Suite ─────────────────────────────────────────────────────────────────────
integrationDescribe('C16.3 — Concurrencia real: SELECT FOR UPDATE en PostgreSQL', () => {
  let prisma: PrismaClient;
  let service: ProgramasService;
  let fixtures: TestFixtures | undefined;

  // Sufijo único por ejecución para evitar colisiones en restricciones UNIQUE
  const sufijo = Date.now().toString().slice(-8);

  // ── Antes de todos los tests ───────────────────────────────────────────────
  beforeAll(async () => {
    // ── Validación de seguridad (punto 1–4 del spec) ────────────────────────
    let dbName: string;
    try {
      dbName = new URL(TEST_DB_URL).pathname.replace(/^\//, '');
    } catch {
      throw new Error(
        `TEST_INTEGRATION_DATABASE_URL tiene formato inválido: "${TEST_DB_URL}"\n` +
        `Ejemplo válido: postgresql://usuario:clave@localhost:5432/udemm_test`,
      );
    }

    if (!dbName) {
      throw new Error(
        'TEST_INTEGRATION_DATABASE_URL no incluye un nombre de base de datos.\n' +
        'Ejemplo: postgresql://usuario:clave@localhost:5432/udemm_test',
      );
    }

    if (dbName === 'udemm_global') {
      throw new Error(
        '⛔ SEGURIDAD: TEST_INTEGRATION_DATABASE_URL apunta a la BD de desarrollo "udemm_global".\n' +
        'El test de integración requiere una BD exclusiva para pruebas.\n' +
        'Crear una BD dedicada (ej: udemm_test) y configurar TEST_INTEGRATION_DATABASE_URL.',
      );
    }

    if (/prod/i.test(dbName)) {
      throw new Error(
        `⛔ SEGURIDAD: TEST_INTEGRATION_DATABASE_URL parece apuntar a una BD de producción ("${dbName}").\n` +
        'Usar únicamente una BD exclusiva para tests de integración.',
      );
    }

    // ── Conexión exclusiva a la BD de test ───────────────────────────────────
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await prisma.$connect();

    const scopeService = new ScopeService(prisma as any);
    service = new ProgramasService(prisma as any, scopeService as any);

    // ── Fixtures auto-contenidos (punto 5 del spec) ──────────────────────────
    // Toda la jerarquía se crea aquí y se elimina en afterAll.
    // No se reutiliza ningún dato preexistente de la BD.

    const rol = await prisma.rol.create({
      data: { nombre: `[TEST-C162-${sufijo}]`, activo: true },
    });

    const univ = await prisma.universidad.create({
      data: { nombre: `[TEST-C162] Universidad ${sufijo}` },
    });

    // El usuario es el ejecutor del endpoint de regularización.
    // Su rolId es el rol de test, no un rol APROBADOR, por lo que
    // notificarDirectivos no le creará notificaciones a él mismo.
    const usuario = await prisma.usuario.create({
      data: {
        nombre:            'Test',
        apellido:          'C162',
        correoElectronico: `test-c162-${sufijo}@test.invalid`,
        contrasenaHash:    'no-es-real-hash-de-test',
        rolId:             rol.id,
        activo:            true,
      },
    });

    const facultad = await prisma.facultad.create({
      data: { nombre: `[TEST-C162] Facultad ${sufijo}`, universidadId: univ.id },
    });

    const carrera = await prisma.carrera.create({
      data: {
        nombre:    `[TEST-C162] Carrera ${sufijo}`,
        facultadId: facultad.id,
        codigo:    `TC162-${sufijo}`,
      },
    });

    const plan = await prisma.planEstudio.create({
      data: { nombre: `[TEST-C162] Plan ${sufijo}`, carreraId: carrera.id },
    });

    const materia = await prisma.materia.create({
      data: {
        nombre:        `[TEST-C162] Materia ${sufijo}`,
        planEstudioId:  plan.id,
        codigo:        `MT162-${sufijo}`,
      },
    });

    // Programa completo al 100% — todas las secciones COMPLETO
    const prog = await prisma.programaAsignatura.create({
      data: {
        materiaId:                    materia.id,
        estadoPrograma:               'EN_REVISION',
        estadoS1: 'COMPLETO', estadoS2: 'COMPLETO', estadoS3: 'COMPLETO',
        estadoS4: 'COMPLETO', estadoS5: 'COMPLETO', estadoS6: 'COMPLETO',
        objetivosGenerales:           TEXTO,
        aportesPerfilTitulo:          TEXTO,
        competenciasResultadosJson:   JSON.stringify([{ competencia: 'c', resultadoAprendizaje: 'r' }]),
        contenidosGridJson:           JSON.stringify([{ conceptuales: 'c', procedimentales: 'p', actitudinales: 'a' }]),
        unidadesDidacticasJson:       JSON.stringify([{ unidad: 'u1' }]),
        actividadesFormacionPractica: TEXTO,
        formacionPracticaJson:        JSON.stringify([{ intensidad: 'alta', horasClase: 4 }]),
        recursosDidacticos:           TEXTO,
        metodologiaEnsenanza:         TEXTO,
        modalidadEvaluacion:          TEXTO,
        requisitosAprobacion:         TEXTO,
        bibliografiaBasica:           TEXTO,
        fechaVigenciaPrograma:        2025,
        fechaAprobacion:              new Date('2024-12-01'),
      },
    });

    fixtures = {
      rolId:      rol.id,
      univId:     univ.id,
      usuarioId:  usuario.id,
      facultadId: facultad.id,
      carreraId:  carrera.id,
      planId:     plan.id,
      materiaId:  materia.id,
      programaId: prog.id,
    };
  }, 30_000);

  // ── Limpieza completa (punto 5 del spec) ───────────────────────────────────
  afterAll(async () => {
    if (!prisma) return;

    if (fixtures) {
      // 1. Notificaciones vinculadas a las solicitudes del programa de test
      const solicitudes = await prisma.solicitudAprobacionPrograma.findMany({
        where:  { programaId: fixtures.programaId },
        select: { id: true },
      });
      if (solicitudes.length > 0) {
        await prisma.notificacion.deleteMany({
          where: { solicitudProgramaId: { in: solicitudes.map(s => s.id) } },
        });
      }

      // 2. Notificaciones dirigidas al usuario de test (prevención defensiva)
      await prisma.notificacion.deleteMany({
        where: { usuarioId: fixtures.usuarioId },
      });

      // 3. Materia → cascada: programaAsignatura → solicitudes + historial
      await prisma.materia.delete({ where: { id: fixtures.materiaId } });

      // 4. Resto de la jerarquía institucional de test
      await prisma.planEstudio.delete({ where: { id: fixtures.planId } });
      await prisma.carrera.delete({ where: { id: fixtures.carreraId } });
      await prisma.facultad.delete({ where: { id: fixtures.facultadId } });

      // 5. Usuario de test (historialPrograma ya eliminado por cascada en paso 3)
      await prisma.usuario.delete({ where: { id: fixtures.usuarioId } });

      // 6. Universidad y Rol de test
      await prisma.universidad.delete({ where: { id: fixtures.univId } });
      await prisma.rol.delete({ where: { id: fixtures.rolId } });
    }

    await prisma.$disconnect();
  }, 30_000);

  // ── Test de concurrencia (puntos 6–7 del spec) ─────────────────────────────
  test(
    'Dos regularizaciones concurrentes → una GENERADA, una OMITIDO, ' +
    'exactamente 1 solicitud, 1 historial y sin notificaciones duplicadas',
    async () => {
      if (!fixtures) return; // guarda defensiva; describe.skip debería prevenirlo

      const dto = { programaIds: [fixtures.programaId] } as GenerarRegularizacionDto;

      // Ambas llamadas se lanzan sin await intermedio.
      // Cada $transaction usa una conexión independiente del pool.
      // SELECT ... FOR UPDATE en la primera bloquea a la segunda hasta commit.
      const [r1, r2] = await Promise.all([
        service.generarSolicitudesRegularizacion(dto, fixtures.usuarioId),
        service.generarSolicitudesRegularizacion(dto, fixtures.usuarioId),
      ]);

      const resultados = [r1.detalle[0].resultado, r2.detalle[0].resultado];

      // ── Una GENERADA, una OMITIDO (en cualquier orden) ───────────────────
      expect(resultados).toContain('GENERADA');
      expect(resultados).toContain('OMITIDO');
      expect(resultados.filter(r => r === 'GENERADA')).toHaveLength(1);
      expect(resultados.filter(r => r === 'OMITIDO')).toHaveLength(1);

      // ── Exactamente UNA solicitud PENDIENTE_APROBACION en BD ─────────────
      const solicitudesTotal = await prisma.solicitudAprobacionPrograma.findMany({
        where: { programaId: fixtures.programaId },
      });
      expect(solicitudesTotal).toHaveLength(1);
      expect(solicitudesTotal[0].estado).toBe('PENDIENTE_APROBACION');

      // ── Exactamente UN historial REGULARIZACION_HISTORICA en BD ──────────
      const historialTotal = await prisma.historialPrograma.findMany({
        where: { programaId: fixtures.programaId, accion: 'REGULARIZACION_HISTORICA' },
      });
      expect(historialTotal).toHaveLength(1);

      // ── Sin notificaciones duplicadas por usuario ─────────────────────────
      // notificarDirectivos usa deduplicación interna; confirmamos aquí.
      const notificaciones = await prisma.notificacion.findMany({
        where: { solicitudProgramaId: solicitudesTotal[0].id },
      });
      const contadoresPorUsuario = new Map<string, number>();
      for (const n of notificaciones) {
        if (n.usuarioId) {
          contadoresPorUsuario.set(n.usuarioId, (contadoresPorUsuario.get(n.usuarioId) ?? 0) + 1);
        }
      }
      for (const [, count] of contadoresPorUsuario) {
        expect(count).toBe(1); // máximo una notificación por usuario y solicitud
      }

      // ── El solicitudId reportado por la GENERADA coincide con el creado ───
      const generada = r1.detalle[0].resultado === 'GENERADA' ? r1 : r2;
      expect(generada.detalle[0].solicitudId).toBe(solicitudesTotal[0].id);
    },
    15_000,
  );
});
