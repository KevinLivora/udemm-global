import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { DocentesModule } from './modules/docentes/docentes.module';
import { MateriasModule } from './modules/materias/materias.module';
import { PlanesModule } from './modules/planes/planes.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
import { ParametrosModule } from './modules/parametros/parametros.module';
import { FacultadesModule } from './modules/facultades/facultades.module';
import { CarrerasModule } from './modules/carreras/carreras.module';
import { ProgramasModule } from './modules/programas/programas.module';
import { TablasMaestrasModule } from './modules/tablas-maestras/tablas-maestras.module';
import { VinculacionesModule } from './modules/vinculaciones/vinculaciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { AreasDisiplinaresModule } from './modules/areas-disciplinares/areas-disciplinares.module';
import { NormativasModule } from './modules/normativas/normativas.module';
import { ScopeModule } from './modules/scopes/scope.module';
import { AutoevaluacionModule } from './modules/autoevaluacion/autoevaluacion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      {
        // Nombre 'default' requerido: @Throttle({ default: {...} }) en los
        // controladores almacena metadata bajo la clave THROTTLER_LIMIT+'default'.
        // El guard lee esa clave usando namedThrottler.name — si no coincide,
        // el override se ignora y se aplica el límite global (100/60s).
        name: 'default',
        ttl: 60_000, // 1 minuto (en ms)
        limit: 100,  // máx. 100 solicitudes/IP/minuto para el API general
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    DocentesModule,
    MateriasModule,
    PlanesModule,
    DocumentosModule,
    ParametrosModule,
    FacultadesModule,
    CarrerasModule,
    ProgramasModule,
    TablasMaestrasModule,
    VinculacionesModule,
    NotificacionesModule,
    AreasDisiplinaresModule,
    NormativasModule,
    ScopeModule,
    AutoevaluacionModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
